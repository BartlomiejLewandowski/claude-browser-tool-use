# Claude Pro Tool-Use within Conversations

This project is a Chrome extension tied with a node.js server that allows users to add tools which can be used by Claude.

## How it works

- The content script is injected onto the claude.ai/chat page, which shows an indicator containing "system" messages. These will come as results from operations performed on the server side (by using tools provided there).
- A background script listens for all messages sent back from Claude. It sends them to the server, which processes the message and if there is a tool required, it will perform the operation. Once the operation is complete, it will notify the content script, which store the result in a system message.
- The server listening to requests from the background script. You can extend the functionality with more tools there.

## Getting Started

### Setup

1. Clone this repository
2. Install dependencies in both the extension and server directories:
   ```
   cd extension && npm install
   cd ../server && npm install
   ```
3. Configure the tools you want to use:
   ```
   cd server && npm run setup
   ```
   This will show you the status of all registered tools and guide you through the setup process for each one.

### Tool Setup

For each tool you want to use, you'll need to:

1. Setup API credentials:
   ```
   npm run setup -- setup <tool>
   ```

2. Authenticate with the service:
   ```
   npm run setup -- auth <tool>
   ```

3. Verify that the tool is working:
   ```
   npm run setup -- verify <tool>
   ```

### Available Tools

- **Calendar**: Create events in Google Calendar
- **Spotify**: Play music on your Spotify devices

### Running the Extension

1. Load the extension in Chrome:
    - Go to `chrome://extensions/`
    - Enable "Developer mode"
    - Click "Load unpacked" and select the `extension` directory

2. Start the server:
   ```
   cd server && npm run dev
   ```

3. Open Claude at [claude.ai](https://claude.ai)

4. Try using a tool by asking Claude to perform an action, for example:
   ```
   Can you create a calendar event for a team meeting tomorrow at 3pm?
   ```
   or
   ```
   Please play "Here Comes the Sun" by The Beatles on Spotify.
   ```

## Adding New Tools

To add a new tool:

1. Create a new file in the `server/tool` directory
2. Implement the `Tool` interface with the required methods
3. Register your tool using `registerTool` from the registry

Example:
```typescript
import { Tool, ToolResult, ToolSetupState, ToolSetupStatus } from './tool';
import { registerTool } from './registry';

class MyNewTool implements Tool {
    getTagName(): string {
        return 'mytool';
    }
    
    // Implement required methods...
    
    async run(messageContent: string): Promise<ToolResult> {
        // Your tool logic here
    }
    
    async checkSetupStatus(): Promise<ToolSetupStatus> {
        // Check if credentials exist, etc.
    }
    
    async setupCredentials(): Promise<boolean> {
        // Guide user through credential setup
    }
    
    async authenticate(): Promise<boolean> {
        // Authenticate with the service
    }
}

// Register the tool
export const myNewTool = new MyNewTool();
registerTool(myNewTool);
```

## TODO?

- [ ] Add more tools (email, note-taking, etc.)
- [ ] Improve error handling and user feedback
- [ ] Add support for more complex tool interactions
- [ ] Implement a web interface for tool management
