# Fiori Test Agent - Dynamic MCP Server Generator

This tool analyzes any Fiori application and dynamically generates a standardized MCP (Model Context Protocol) server with tools for automated testing and interaction.

## Features

- **Dynamic Analysis**: Automatically extracts filters, tables, actions, and form fields from any Fiori app
- **Standardized MCP Server**: Generates a complete MCP server with 12 standard tools
- **Universal Compatibility**: Works with any Fiori application without manual configuration
- **Real-time Interaction**: Provides tools for live interaction with the application

## Generated MCP Tools

The generated MCP server includes these standardized tools:

1. **`start_app`** - Start the Fiori application
2. **`press_go`** - Press the Go button to refresh table data
3. **`get_table_rows`** - Get current table rows data
4. **`set_filter`** - Set a filter value
5. **`execute_action`** - Execute an action on the table
6. **`select_row`** - Select a specific row in the table
7. **`open_object_page`** - Open object page for a selected row
8. **`get_object_actions`** - Get available actions on object page
9. **`execute_object_action`** - Execute an action on object page
10. **`fill_form_field`** - Fill a form field
11. **`submit_form`** - Submit the current form
12. **`close_app`** - Close the application

## Installation

```bash
npm install
```

## Usage

### 1. Generate MCP Server for a Fiori App

```bash
# Basic usage
node src/generate-mcp-server.js "https://your-fiori-app.com/flp.html"

# Specify output file
node src/generate-mcp-server.js "https://your-fiori-app.com/flp.html" "./my-fiori-server.js"
```

### 2. Use the Generated MCP Server

```bash
# Install MCP dependencies
npm install @modelcontextprotocol/sdk playwright

# Run the generated server
node generated-fiori-mcp-server.js
```

### 3. Interactive Testing (Optional)

For manual testing and development:

```bash
# Set the Fiori app URL
$env:URL="https://your-fiori-app.com/flp.html"

# Start interactive REPL
node src/rc-repl.js
```

## How It Works

1. **Analysis Phase**: 
   - Launches a browser and navigates to the Fiori app
   - Waits for UI5 to initialize
   - Extracts all filters, table actions, and form fields
   - Builds a metadata object describing the app structure

2. **Generation Phase**:
   - Creates a complete MCP server with standardized tools
   - Embeds the extracted metadata into the server code
   - Generates dynamic selectors and field mappings
   - Outputs a ready-to-run MCP server file

3. **Runtime Phase**:
   - The generated server can be used by any MCP client
   - Provides consistent interface across different Fiori apps
   - Handles authentication, navigation, and form interactions

## Example Generated Server

The generator creates a complete MCP server that includes:

- **App Metadata**: Filters, tables, actions extracted from your specific app
- **Standardized Tools**: 12 tools that work with any Fiori application
- **Dynamic Field Detection**: Automatically finds and interacts with form fields
- **Error Handling**: Robust error handling and user feedback

## Supported Fiori Patterns

- **List Reports**: Table views with filters and actions
- **Object Pages**: Detail views with form fields and actions
- **Filter Bars**: Dynamic filter extraction and interaction
- **Table Actions**: Create, Delete, and custom actions
- **Form Fields**: Text inputs, dropdowns, date pickers, etc.

## Troubleshooting

### Authentication Issues
- The generator opens a visible browser for manual login
- Complete authentication in the browser window
- The server will wait for UI5 initialization

### Field Not Found Errors
- Use the interactive REPL to test field names: `getFormFields`
- Check the generated metadata for available fields
- Field matching is case-insensitive and supports partial matching

### Timeout Issues
- Increase timeout values in the generated server if needed
- Ensure stable network connection to the Fiori app

## Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Fiori App URL     │───▶│  MCP Generator       │───▶│  Generated MCP       │
│                     │    │                      │    │  Server              │
│ - Login required    │    │ - Analyzes app       │    │                      │
│ - UI5 framework     │    │ - Extracts metadata  │    │ - Standardized tools │
│ - Dynamic content   │    │ - Generates server   │    │ - App-specific data  │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

## Contributing

This tool is designed to be extensible. You can:

- Add new tool patterns to the generator
- Extend the metadata extraction logic
- Customize the generated server template
- Add support for additional Fiori patterns

## License

MIT License - Feel free to use and modify for your needs.

---

## Quick Start (GitHub)

1) Install Node.js dependencies

```bash
npm install
```

2) Generate both servers (stdio and HTTP) for your Fiori app URL

```bash
node src/generate-mcp-server.js "https://your-fiori-app/flp.html#app-preview" --both
```

3a) Run stdio MCP server (for MCP-native clients)

```powershell
$env:HEADLESS = "1"
node generated-fiori-mcp-server.js
```

3b) Or run HTTP server (REST-friendly; binds to 0.0.0.0)

```powershell
$env:HEADLESS = "1"
node generated-fiori-mcp-http-server.js
```

Health check:

```bash
curl http://localhost:3000/health
```

## Calling tools

- HTTP: `POST /call` with `{ name: string, arguments: object }`

```bash
curl -X POST http://localhost:3000/call \
  -H "Content-Type: application/json" \
  -d '{"name":"start_app","arguments":{}}'
```

- stdio JSON-RPC 2.0 framing example (PowerShell):

```powershell
$env:HEADLESS = "1"
node -e "const enc='utf8'; const msgs=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{}}},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'start_app',arguments:{}}}]; const frames=msgs.map(m=>{const s=JSON.stringify(m);return `Content-Length: ${Buffer.byteLength(s,enc)}\r\n\r\n${s}`}).join(''); process.stdout.write(frames);" | node generated-fiori-mcp-server.js
```

## Configuration

- `HEADLESS=1` to hide browser (recommended for CI/Cloud Foundry)
- `URL` to override the app URL at runtime (optional)
- `DEBUG_MCP=1` for verbose stdio logs

## Notes

- Internal UI5 buttons (e.g., `__button*-internalBtn`) are filtered out from `get_table_actions`/`get_object_actions`.
- `execute_action`/`execute_object_action` return structured payloads with a `scenario` (`form_opened`, `popup_dialog`, `error_messages`, `action_completed`) and may include `formFields`, `messages`, and dialog button metadata when present.
- `get_messages` includes dialog buttons when a dialog is open.
- Server auto-recovers if the page is not initialized by starting the app on demand.

## Python utilities (optional)

Some helper scripts use Python; see `requirements.txt` for optional packages. They are not required to run the Node.js servers.