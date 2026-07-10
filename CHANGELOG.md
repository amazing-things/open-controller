# Changelog

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
