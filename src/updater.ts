import { execSync, spawn } from "child_process"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { homedir } from "os"
import { fileURLToPath } from "url"

const NPM_TIMEOUT_MS = 60_000
const CHECK_TIMEOUT_MS = 30_000

const PKG_NAME = "open-controller"

const isDisabled = (): boolean => {
  const v = process.env.OPENCONTROLLER_DISABLE_UPDATER
  return v === "1" || v === "true"
}

const isCI = (): boolean =>
  !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI
  )

const readLocalVersion = (): string | null => {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json")
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string; version?: string }
    if (pkg.name === PKG_NAME && pkg.version) return pkg.version
  } catch {}
  return null
}

const npmViewLatest = (): string | null => {
  try {
    const out = execSync(`npm view ${PKG_NAME} version`, {
      encoding: "utf8",
      timeout: CHECK_TIMEOUT_MS,
      windowsHide: true,
    }).trim()
    return out || null
  } catch {
    return null
  }
}

const compareSemver = (a: string, b: string): number => {
  const pa = a.replace(/^v/, "").split(".").map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, "").split(".").map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}

const runNpmInstall = (): boolean => {
  try {
    const self = dirname(fileURLToPath(import.meta.url))
    const configRoot = join(self, "..", "..", "..")
    execSync(`npm install ${PKG_NAME}@latest --no-audit --no-fund --no-progress`, {
      cwd: configRoot,
      encoding: "utf8",
      timeout: NPM_TIMEOUT_MS,
      windowsHide: true,
      shell: "cmd.exe",
    })
    return true
  } catch (e: any) {
    console.warn(
      `[open-controller] Auto-update failed: ${e?.message ?? "unknown"}.`,
    )
    return false
  }
}

const notifyWindows = (title: string, message: string): void => {
  const body = message.replace(/'/g, "''")
  const t = title.replace(/'/g, "''")
  const script = `
    [reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null
    [reflection.assembly]::loadwithpartialname('System.Drawing') | Out-Null
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = [System.Drawing.SystemIcons]::Information
    $n.Visible = $true
    $n.ShowBalloonTip(8000, '${t}', '${body}', [System.Windows.Forms.ToolTipIcon]::Info)
    Start-Sleep -Seconds 1
    $n.Dispose()
  `
  try {
    spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref()
  } catch (e: any) {
    console.warn(`[open-controller] Notification failed: ${e?.message ?? "unknown"}`)
  }
}

export const runUpdater = (): void => {
  if (isDisabled()) {
    console.log("[open-controller] Updater disabled via OPENCONTROLLER_DISABLE_UPDATER=1")
    return
  }
  if (isCI()) {
    return
  }

  setImmediate(() => {
    void (async () => {
      try {
        const local = readLocalVersion()
        if (!local) return

        const latest = await new Promise<string | null>((resolve) => {
          try {
            const out = execSync(`npm view ${PKG_NAME} version --json`, {
              encoding: "utf8",
              timeout: CHECK_TIMEOUT_MS,
              windowsHide: true,
            })
              .toString()
              .trim()
            resolve(out ? JSON.parse(out) : null)
          } catch {
            resolve(npmViewLatest())
          }
        })

        if (!latest) return
        if (compareSemver(local, latest) >= 0) return

        console.log(`[open-controller] Updating ${local} -> ${latest}...`)
        const ok = runNpmInstall()
        if (!ok) return

        notifyWindows(
          "open-controller",
          "The open controller has been updated. Please restart open code.",
        )
        console.log(`[open-controller] Updated to ${latest}. Restart required.`)
      } catch (e: any) {
        console.warn(
          `[open-controller] Updater error: ${e?.message ?? "unknown"}`,
        )
      }
    })()
  })
}
