import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { execSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const PYTHON_CMD = "C:\\Program Files\\Python311\\python.exe"
const MCP_WRAPPER = join(homedir(), ".windows-mcp", "mcp_runner.py")
const PRE_WARM_TIMEOUT_MS = 30000
const PC_EXEC_TIMEOUT_MS = 60000
const MCP_DEFAULT_TIMEOUT_MS = 600000
const INSTRUCTIONS_FILE = join(__dirname, "..", "instructions", "WINDOWS_CONTROLLER.md")

const ps = (cmd: string): string => {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      timeout: PC_EXEC_TIMEOUT_MS,
      shell: "powershell",
    }).trim()
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

const checkMcpInstalled = (): boolean => {
  try {
    execSync(
      `"${PYTHON_CMD}" -c "from windows_mcp.__main__ import main"`,
      { encoding: "utf8", timeout: 30000 },
    )
    return true
  } catch {
    return false
  }
}

const PcControllerPlugin: Plugin = async (_ctx) => {
  const installed = checkMcpInstalled()

  if (installed) {
    try {
      execSync(
        `"${PYTHON_CMD}" -c "import comtypes.client, windows_mcp; from windows_mcp.desktop.service import Desktop; d=Desktop(); d.get_screen_size(); del d; print('pre-warm-ok')"`,
        { encoding: "utf8", timeout: PRE_WARM_TIMEOUT_MS },
      )
    } catch (e: any) {
      console.warn(
        `[open-controller] Pre-warm failed (${e?.message ?? "unknown"}); MCP server will retry on first tool call.`,
      )
    }
  }

  if (!installed) {
    console.warn(
      "[open-controller] windows_mcp package not found. Install: pip install windows-mcp",
    )
  }

  let systemInstructions = ""
  try {
    if (existsSync(INSTRUCTIONS_FILE)) {
      systemInstructions = readFileSync(INSTRUCTIONS_FILE, "utf8")
    } else {
      console.warn(
        `[open-controller] System instructions not found at ${INSTRUCTIONS_FILE}. Plugin will run without them.`,
      )
    }
  } catch (e: any) {
    console.warn(
      `[open-controller] Failed to load system instructions: ${e?.message ?? "unknown"}`,
    )
  }

  return {
    config: async (cfg: any) => {
      cfg.mcp ??= {}
      const mcpTimeoutMs = Number.parseInt(
        process.env.OPENCONTROLLER_MCP_TIMEOUT_MS ?? "",
        10,
      )
      const effectiveTimeoutMs =
        Number.isFinite(mcpTimeoutMs) && mcpTimeoutMs > 0
          ? mcpTimeoutMs
          : MCP_DEFAULT_TIMEOUT_MS
      cfg.mcp["windows-mcp"] = {
        type: "local",
        command: [PYTHON_CMD, MCP_WRAPPER, "serve", "--transport", "stdio"],
        enabled: true,
        timeout: effectiveTimeoutMs,
        environment: {
          ANONYMIZED_TELEMETRY: "false",
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
        },
      }
    },

    tool: {
      "pc-exec": tool({
        description:
          "Execute a PowerShell command on this Windows PC. Use for file, process, registry, clipboard, UI automation tasks. Default timeout 60s.",
        args: {
          command: tool.schema.string().describe("PowerShell command to execute"),
        },
        execute: async (args) => {
          const out = ps(args.command)
          return out.length > 4000
            ? out.slice(0, 4000) + "\n... (truncated)"
            : out
        },
      }),

      "pc-screenshot": tool({
        description: "Capture a screenshot of the current desktop as base64 PNG.",
        args: {},
        execute: async () => {
          const b64 = ps(`
            Add-Type -AssemblyName System.Drawing
            $bmp = [Drawing.Bitmap]::new([Drawing.SystemInformation]::VirtualScreen.Width, [Drawing.SystemInformation]::VirtualScreen.Height)
            $g = [Drawing.Graphics]::FromImage($bmp)
            $g.CopyFromScreen([Drawing.SystemInformation]::VirtualScreen.X, [Drawing.SystemInformation]::VirtualScreen.Y, 0, 0, $bmp.Size)
            $ms = New-Object IO.MemoryStream
            $bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png)
            [Convert]::ToBase64String($ms.ToArray())
            $g.Dispose(); $bmp.Dispose(); $ms.Dispose()
          `)
          return {
            output: b64,
            attachments: [
              {
                type: "file",
                mime: "image/png",
                url: `data:image/png;base64,${b64}`,
              },
            ],
          }
        },
      }),

      "pc-mcp-status": tool({
        description:
          "Check whether the windows-mcp Python package is importable, and the latest pre-warm result. Useful to diagnose MCP -32001 timeouts.",
        args: {},
        execute: async () => {
          const importOk = ps(
            `"${PYTHON_CMD}" -c "import windows_mcp; print('import:ok'); from windows_mcp.desktop.service import Desktop; d=Desktop(); d.get_screen_size(); del d; print('init:ok')"`,
          )
          return importOk
        },
      }),

      "pc-mcp-instructions": tool({
        description:
          "Return the system instructions that this plugin injects into the agent's system prompt. Use it to confirm what rules the agent is following, or to remind yourself of the recovery playbook.",
        args: {},
        execute: async () => {
          if (!systemInstructions) {
            return "System instructions are not available. The instructions file was not found at plugin startup."
          }
          return systemInstructions
        },
      }),
    },

    "experimental.chat.system.transform": async (
      _input: { sessionID?: string; model?: any },
      output: { system: string[] },
    ) => {
      if (systemInstructions) {
        output.system.push(systemInstructions)
      }
    },
  }
}

export default { id: "open-controller", server: PcControllerPlugin }
