# Changelog

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
