# OpenCode PC Controller Plugin

Control your Windows PC directly from OpenCode. Uses the [windows-mcp](https://github.com/CursorTouch/Windows-MCP) MCP server under the hood.

## Features

- **Desktop UI Automation** — click, type, scroll, drag, switch apps, resize windows
- **File System** — read, write, copy, move, delete files and directories
- **PowerShell** — execute any PowerShell commands
- **Screenshots** — capture and analyze desktop screenshots
- **Registry** — read, write, delete registry keys
- **Process** — list and kill running processes
- **Clipboard** — get and set clipboard content
- **Notifications** — send Windows toast notifications
- **Web Scraping** — fetch and extract web page content
- **Snapshot** — inspect UI elements on screen with coordinates
- **Multi-actions** — batch select and edit multiple UI elements

## Prerequisites

- Node.js 18+
- OpenCode
- Python 3.11+

## Installation

### 1. Install the npm plugin

In your OpenCode config directory (typically `%USERPROFILE%\.config\opencode`):

```cmd
cd %USERPROFILE%\.config\opencode
npm install open-controller
```

Or with PowerShell:

```powershell
cd ~\.config\opencode
npm install open-controller
```

### 2. Install the MCP server (Python package)

```bash
pip install windows-mcp
```

### 3. Add to OpenCode config

Add `"open-controller"` to the `"plugin"` array in `%USERPROFILE%\.config\opencode\opencode.jsonc` if not already present:

```jsonc
{
  "plugin": [
    "open-controller",
    // ... other plugins
  ]
}
```

### 4. Restart OpenCode

Try these commands:
- "list files on desktop"
- "take a screenshot"
- "open chrome"
- "run notepad"

## MCP Tools

The plugin registers 19 MCP tools via the `windows-mcp` server:

### App Control
- **App** — launch, switch, or resize application windows
- **Shortcut** — execute keyboard shortcuts (`ctrl+c`, `win+r`, etc.)

### Desktop & UI
- **Snapshot** — capture desktop state with UI tree, interactive elements, and coordinates
- **Screenshot** — fast screenshot with optional annotation overlay
- **Click** — single, double, right-click at coordinates or on UI element labels
- **Type** — type text at coordinates or into UI elements
- **Scroll** — scroll vertically/horizontally at a location
- **Move** — move cursor (hover) or drag-and-drop
- **Wait** — pause execution for a duration
- **WaitFor** — wait for UI condition (text exists, element enabled, window active)

### File System
- **FileSystem** — read, write, copy, move, delete, list, search, get info (8 modes)

### Shell
- **PowerShell** — execute any PowerShell command with timeout

### Clipboard
- **Clipboard** — get or set clipboard text

### Process
- **Process** — list processes (sorted by CPU/memory/name) or kill by PID/name

### Registry
- **Registry** — get, set, delete, list Windows Registry keys/values

### Notifications
- **Notification** — send Windows toast notifications

### Web
- **Scrape** — fetch and extract web page content with optional DOM mode

### Multi
- **MultiSelect** — batch select multiple items (files, checkboxes)
- **MultiEdit** — enter text into multiple input fields

## Built-in Plugin Tools

Two extra tools are registered directly on the plugin:

| Tool | Description |
|------|-------------|
| `pc-exec` | Execute any PowerShell command with output |
| `pc-screenshot` | Capture desktop as base64 PNG image |

## Architecture

```
OpenCode
  └── open-controller plugin (open-controller@1.0.1)
       ├── pc-exec tool (PowerShell)
       ├── pc-screenshot tool (base64 PNG)
       └── MCP Server: windows-mcp (Python)
            ├── App, Snapshot, Screenshot
            ├── Click, Type, Scroll, Move, Wait
            ├── FileSystem, PowerShell, Registry
            ├── Clipboard, Process, Notification
            ├── Scrape, MultiSelect, MultiEdit
            └── Shortcut, WaitFor
```

The plugin:
1. Loads on OpenCode startup
2. Pre-warms the Python MCP server (imports `comtypes.client` for faster first call)
3. Registers the MCP server config in OpenCode
4. Adds `pc-exec` and `pc-screenshot` as native plugin tools

## Development

The plugin source is at the [GitHub repo](https://github.com/amazing-things/open-controller). To modify locally:

```cmd
:: Clone the repo
git clone https://github.com/amazing-things/open-controller.git
cd open-controller

:: Install dependencies
npm install

:: Build
npm run build

:: Use the local version in OpenCode
:: Add "./path/to/open-controller" to opencode.jsonc plugin list
```

Restart OpenCode to apply changes.

## License

MIT — see [LICENSE](LICENSE)

Original windows-mcp by [Jeomon George](https://github.com/CursorTouch)
