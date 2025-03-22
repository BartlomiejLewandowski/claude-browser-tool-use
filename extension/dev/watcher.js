const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

/**
 * Creates a WebSocket server that watches a directory and notifies clients when changes stop for a specified time
 * @param {object} options - Configuration options
 * @param {string} options.directoryPath - The path to the directory to watch
 * @param {number} options.port - The port for the WebSocket server
 * @param {number} options.debounceTime - The time in ms to wait after the last change (default: 5000ms)
 * @returns {object} - The server and watcher instances
 */
function createWatchServer(options) {
    const {
        directoryPath = './',
        port = 8080,
        debounceTime = 5000
    } = options;

    // Normalize and validate the directory path
    const normalizedPath = path.normalize(directoryPath);

    if (!fs.existsSync(normalizedPath)) {
        throw new Error(`Directory does not exist: ${normalizedPath}`);
    }

    if (!fs.statSync(normalizedPath).isDirectory()) {
        throw new Error(`Path is not a directory: ${normalizedPath}`);
    }

    // Create HTTP server
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('WebSocket server for directory watching');
    });

    // Create WebSocket server
    const wss = new WebSocket.Server({ server });

    // Timer to track debounce
    let debounceTimer = null;

    // Handle WebSocket connections
    wss.on('connection', (ws) => {
        console.log('Client connected');

        // Send initial connection message
        ws.send(JSON.stringify({
            type: 'info',
            message: `Connected. Watching directory: ${normalizedPath} with ${debounceTime}ms debounce`
        }));

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });

    // Broadcast message to all connected clients
    const broadcast = (message) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    };

    // Create directory watcher
    const watcher = fs.watch(normalizedPath, { recursive: true }, (eventType, filename) => {
        console.log(`Change detected: ${eventType} in ${filename}`);

        // Notify clients of the change
        broadcast({
            type: 'change',
            eventType,
            filename,
            timestamp: new Date().toISOString()
        });

        // Clear any existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        // Set a new timer
        debounceTimer = setTimeout(() => {
            console.log(`No changes detected for ${debounceTime}ms, sending reload message`);

            // Send reload message to all clients
            broadcast({
                type: 'reload',
                message: 'Time to reload',
                timestamp: new Date().toISOString()
            });
        }, debounceTime);
    });

    // Start the server
    server.listen(port, () => {
        console.log(`WebSocket server running on port ${port}`);
        console.log(`Watching directory: ${normalizedPath} with ${debounceTime}ms debounce`);
    });

    // Return the server and watcher for external control
    return {
        server,
        watcher,
        stop: () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            watcher.close();
            server.close();
            console.log(`Stopped watching directory: ${normalizedPath}`);
            console.log(`WebSocket server on port ${port} closed`);
        }
    };
}

// Run as standalone server if executed directly
if (require.main === module) {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const directoryArg = args.find(arg => !arg.startsWith('--'));
    const portArg = args.find(arg => arg.startsWith('--port='));
    const debounceArg = args.find(arg => arg.startsWith('--debounce='));

    const options = {
        directoryPath: directoryArg || './',
        port: portArg ? parseInt(portArg.split('=')[1], 10) : 8080,
        debounceTime: debounceArg ? parseInt(debounceArg.split('=')[1], 10) : 5000
    };

    const watchServer = createWatchServer(options);

    // Handle process termination
    process.on('SIGINT', () => {
        watchServer.stop();
        process.exit(0);
    });

    console.log('\nPress Ctrl+C to stop the server');
}
