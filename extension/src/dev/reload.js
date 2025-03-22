// Simple WebSocket client with 5-second retry
let socket;
let isConnected = false;

function connectWebSocket() {
    // Don't attempt to reconnect if we're already connected
    if (isConnected) return;

    console.log('Attempting to connect to WebSocket server...');

    // Create new WebSocket connection
    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log('Connected to file watcher server');
        isConnected = true;
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Received:', data);

            if (data.type === 'reload') {
                console.log('Reloading...');
                chrome.runtime.reload();
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    };

    socket.onclose = () => {
        console.log('Disconnected from file watcher server');
        isConnected = false;
        // Schedule reconnection after 5 seconds
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = () => {
        // Let onclose handle the reconnection
        if (socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
    };
}

// Initial connection attempt
connectWebSocket();

// Also try to reconnect when connection fails
setInterval(() => {
    if (!isConnected) {
        connectWebSocket();
    }
}, 5000);
