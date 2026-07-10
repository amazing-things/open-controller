# Windows Controller — Agent Operating Guide

You have access to a Windows desktop via the `windows-mcp` MCP server (tool prefix `windows-mcp_*`) and the native plugin tools `pc-exec`, `pc-screenshot`, and `pc-mcp-status`. The system below is **mandatory** for every task that touches the desktop. It is the result of the most common failure modes reported by users in the wild — read it before your first action, not after your first failure.

## 1. Core principles

1. **Snapshot is ground truth, not screen pixels.** Never infer UI state from a description. Always call `windows-mcp_Snapshot` (or `windows-mcp_Screenshot` for fast visual checks) before clicking, typing, or asserting. The snapshot tree carries `bounds`, `name`, `control_type`, `class_name`, and a numeric `label` that you pass to `windows-mcp_Click` / `windows-mcp_Type` as a label id (`loc: <label>`).
2. **Foreground is a precondition, not an assumption.** Windows has a strict "received the last input event" rule. Even if `Snapshot` reports a target window as `active_window`, the foreground may flip during the 100–300 ms `SendInput` race. **Verify `active_window` after every operation**, not just before.
3. **One tool call, one commitment.** Do not chain `windows-mcp_Click` → `windows-mcp_Type` in the same turn if the click might land on the wrong window. Snapshot → read → decide → act.
4. **If `MCP error -32001: Request timed out` appears, the operation didn't fail — it just didn't finish in 30 s.** The MCP client cancels. Retry **once** with a fresh `Snapshot`; do not retry the same call blindly, the UIA enumeration may still be hung.
5. **Heavy UIA calls cost seconds, not milliseconds.** `Snapshot` with `use_ui_tree: true` on a busy window (browser, IDE, Electron) can take 5–15 s. Plan for it; never issue it twice in a row.

## 2. Workflow: do this on every UI task

```
windows-mcp_Snapshot(use_ui_tree=true, use_vision=true, use_dom=true)
        │
        ▼
Read active_window, focused control, target element bounds
        │
        ├── active_window matches intent? ── yes ──► act (Click / Type / Wait)
        │                                              │
        │                                              ▼
        │                                      re-Snapshot to verify
        │                                              │
        │                                              ▼
        │                                      did the result match? end
        │
        └── no ──► windows-mcp_App(mode="switch", name=<exact title>)
                  then wait 500 ms, then re-Snapshot, then continue
```

If `windows-mcp_App(mode="switch")` does not bring the window forward, fall back to `pc-exec` with PowerShell:

```powershell
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }
"@
# resolve hwnd from title, then:
[W]::SetForegroundWindow($hwnd)
```

## 3. Foreground verification (the "am I really on the right window?" check)

The MCP server exposes `active_window` in the snapshot response. Treat any of the following as a hard "stop and re-foreground" signal:

- `active_window` is `null` or has an empty `name`.
- `active_window.name` does not match the app you are working in.
- The `focused_control` element has no `bounds`, or its bounds are outside `active_window.bounds`.
- A `Snapshot` taken <100 ms after a `Click` reports a *different* `active_window` than the snapshot before the click — this is the focus-transition race and means your `SendInput` is likely targeting the wrong window.

In all four cases, **do not retry the original action**. Re-foreground the target window with `windows-mcp_App(mode="switch", name=...)` (exact title match), sleep 500 ms, snapshot again, and re-resolve the label. Labels from a stale snapshot are invalid after a window switch.

## 4. Snapshot-first, type-after-verify

For form fields and dialogs:

1. `windows-mcp_Snapshot(use_ui_tree=true)` — get the element tree.
2. Identify the target by `name` (not by coordinate alone).
3. `windows-mcp_Click(loc=<label>)` — focus the field.
4. `windows-mcp_Snapshot` again — **verify** the clicked field is now the `focused_control`. If not, the click went to the wrong window; re-foreground and retry.
5. For long text (>30 chars), prefer `pc-exec` to set the clipboard and a single `windows-mcp_Shortcut("ctrl+v")` over character-by-character `windows-mcp_Type`. `SendKeys` with long text can race with the IME / keyboard layout and hang for >30 s.
6. If the field requires the `ENTER` key, send it with `windows-mcp_Shortcut("enter")` after a fresh snapshot that confirms the field still has focus.

## 5. Timeouts and retries

- **MCP -32001 (timed out)**: the call was cancelled. Do **not** assume it failed — check the screen state with a fresh `Snapshot`. The 30 s ceiling is set by the OpenCode MCP client; v1.0.4 of this plugin cannot raise it from the server side.
- **Tool not found**: tool names are case-sensitive. The full set is `windows-mcp_Click`, `windows-mcp_Type`, `windows-mcp_Scroll`, `windows-mcp_Move`, `windows-mcp_Shortcut`, `windows-mcp_Key`, `windows-mcp_Wait`, `windows-mcp_WaitFor`, `windows-mcp_Snapshot`, `windows-mcp_Screenshot`, `windows-mcp_App`, `windows-mcp_Shell`, `windows-mcp_FileSystem` (mode: read/write/copy/move/delete/list/search/info), `windows-mcp_Scrape`, `windows-mcp_MultiSelect`, `windows-mcp_MultiEdit`, `windows-mcp_Clipboard` (get/set), `windows-mcp_Process` (list/kill), `windows-mcp_Notification`, `windows-mcp_Registry` (get/set/delete/list). Use these names exactly.
- **Snapshot returns no controls**: the app may be on the Secure Desktop (UAC dialog, lock screen). User-mode processes cannot inspect or screenshot the Secure Desktop — inform the user instead of looping.
- **RDP / Windows Server sessions**: UIA enumeration may be empty because the active session is session 0. Switch the user's interactive session first, or warn the user.
- **ARM64 hosts**: `comtypes`-based UIA may return zero children even though windows exist. As a fallback, use `pc-exec` with PowerShell + `UIAutomationClient` .NET API.

## 6. Native plugin tools

- `pc-exec` — run a PowerShell command. Default timeout **60 s**; first 4000 chars of output are returned. Use for anything the MCP toolset does not cover: `SetForegroundWindow`, registry tweaks, process inspection, system services.
- `pc-screenshot` — capture the primary monitor as base64 PNG (System.Drawing). Use for visual confirmation when the snapshot tree is empty or wrong.
- `pc-mcp-status` — runs the Python import + `Desktop()` smoke test. If it returns `init: ok`, the MCP server is healthy. If it returns `init: failed`, paste the error to the user — do not retry, the package is broken.

## 7. Don'ts

- **Do not** click by pixel coordinates (`loc: [x, y]`) when a label id is available. The label is resolved against the most recent snapshot; coordinates are not. Coordinates are only acceptable for first-time `App` launches or system tray icons.
- **Do not** call `windows-mcp_Type` with `clear: true` on a password field that has an IME (the IME swallows `{Ctrl}a` and `{Back}` on some Chinese/Japanese layouts).
- **Do not** chain more than three `windows-mcp_*` calls without an intervening `Snapshot` or `WaitFor` — the desktop state may have changed silently.
- **Do not** rely on `windows-mcp_App(mode="launch")` to bring a window to the foreground after launch. It waits for the process to exist (10 s) but does not guarantee foreground; always follow with a snapshot + switch.
- **Do not** run `windows-mcp_Snapshot(use_vision=true, use_ui_tree=true)` in a tight loop. It costs 5–15 s; cache the result and re-snapshot only on a real state change.

## 8. Recovery playbook

| Symptom | Likely cause | Fix |
|---|---|---|
| `MCP error -32001` on `Snapshot` | UIA enumeration hung on a busy window | Sleep 1 s, re-snapshot with `use_ui_tree=false, use_vision=true` (screenshot-only) to recover |
| `Snapshot` reports wrong `active_window` | Focus flipped between click and snapshot | Re-foreground target, then re-snapshot, then re-resolve label |
| `Type` does not change the field value | Wrong window in focus, or IME swallowed keys | Click target, re-snapshot, verify `focused_control`, retry; if IME suspected, paste via clipboard |
| `Snapshot` returns empty tree | Secure Desktop, or app not in active session | Inform user; do not loop |
| `Click` lands on stale coordinates | Window resized/moved between snapshot and click | Re-snapshot, re-resolve label, click again |
| `pc-exec` returns no output | PowerShell command exited immediately with no stdout | Append `; $null` to the script or write to a file and read with `Get-Content` |
