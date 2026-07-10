# Changelog

## 2.0.0

- **Auto-install `windows-mcp`**: if the Python package is not found, the plugin now installs it automatically via `pip install windows-mcp --quiet` instead of printing a manual-install warning.
- **Dynamic Python discovery**: the plugin no longer hardcodes `C:\Program Files\Python311\python.exe`. It probes `python3`, `python`, and common Python 3.13-3.10 install paths and uses the first working one.

## 1.1.9

- Raise the default OpenCode MCP client timeout for `windows-mcp` from **10 minutes** (`600000 ms`) to **20 hours** (`72000000 ms`). The previous 10-minute ceiling was still hit during very long idle windows where the MCP stdio pipe would time out and the next tool call would return `MCP error -32001: Request timed out`. Twenty hours matches a realistic full workday of agent activity, so an OpenCode session left open no longer needs to be restarted mid-shift to recover the `windows-mcp` connection.
- The timeout remains overridable per-machine via the `OPENCONTROLLER_MCP_TIMEOUT_MS` environment variable. Invalid or missing values still fall back to the new 20-hour default.
- README "Timeouts" section updated to reflect the new default and the new override example.

## 1.1.8

- Add a built-in auto-updater. On every OpenCode session start the plugin silently checks the latest version on the npm registry and, if newer, runs `npm install -g open-controller` for the user. A Windows toast notification then asks the user to restart OpenCode so the new code is loaded. The check is fire-and-forget (`setImmediate`) and never blocks the agent.
- Opt out with the `OPENCONTROLLER_DISABLE_UPDATER=1` environment variable. The updater is also a no-op in CI environments (when `CI`, `CONTINUOUS_INTEGRATION`, `GITHUB_ACTIONS`, or `GITLAB_CI` is set).
- Document the new "Auto-update" section in the README.

## 1.1.7

- Set the OpenCode MCP client timeout for `windows-mcp` to **10 minutes** (`600000 ms`) so the long-running UI Automation calls (Snapshot on busy windows, SendKeys on long text, App launch waits) never hit the 30 s default ceiling that produced `MCP error -32001: Request timed out`. This applies even to users who install `windows-mcp` from scratch — the plugin enforces its own timeout, not the OpenCode default.
- The timeout is overridable per-machine via the `OPENCONTROLLER_MCP_TIMEOUT_MS` environment variable. Set it to a positive integer (milliseconds) before launching OpenCode. Invalid or missing values fall back to the 10-minute default.
- Document the new env var in the README's "Timeouts" section.

## 1.1.6

- Extend `instructions/WINDOWS_CONTROLLER.md` with a new "Window positioning (self-managed)" section. The agent is now instructed to detect, classify, and resolve five common window-placement problems (off-screen, covered by another window, too small for the target element, too large for the work area, multi-monitor straddling) **without asking the user**. The rule includes: smallest-change-first principle, the canonical move/resize API (`windows-mcp_App(mode="resize", ...)`), a `pc-exec` PowerShell `MoveWindow` P/Invoke fallback, and explicit situations where the agent must still defer to the user (screen-recording, elevated / Secure Desktop, fullscreen exclusive apps).

## 1.1.5

- No code changes; version bump to 1.1.5 as requested by the maintainer.

## 1.1.0

- Add a system instructions system. The plugin now ships a curated `instructions/WINDOWS_CONTROLLER.md` and injects it into the agent's system prompt on every session via the `experimental.chat.system.transform` hook. The guide covers the most common failure modes reported by windows-mcp users: focus/foreground race, "am I on the right window?" verification, snapshot-first workflow, long-text input via clipboard, MCP -32001 retry semantics, ARM64 / UAC / RDP edge cases, and a recovery playbook.
- Add the `pc-mcp-instructions` tool that returns the full system instructions on demand, so the agent (or a human) can confirm what rules are loaded.
- Document the new "How system instructions work" and "Best practices" sections in the README.
- Bump version to 1.1.0 (minor — adds a new feature: the instruction system).

## 1.0.4

- Fix: `windows-mcp_*` tools no longer hang with `MCP error -32001: Request timed out`.
  - Pass `ANONYMIZED_TELEMETRY=false`, `PYTHONUNBUFFERED=1`, `PYTHONIOENCODING=utf-8` to the MCP server process.
  - Strengthen the plugin's pre-warm: instantiate `Desktop()` and call `get_screen_size()` so the first MCP tool call is fast.
  - Wrap `mcp_runner.py` in try/except with a clear stderr message and proper exit code on import or runtime failure.
  - Bump `checkMcpInstalled` timeout from implicit 30s to explicit 30s; bump `pre-warm` timeout from 15s to 30s.
- Add new `pc-mcp-status` tool that re-runs the import + `Desktop()` smoke test for diagnostics.
- Bump `pc-exec` default timeout from 30s to 60s.
- Document the new troubleshooting steps in the README.

## 1.0.3

- Initial published release.
