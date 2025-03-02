
// popup.js
document.addEventListener('DOMContentLoaded', function() {
    const serverUrl = 'http://localhost:3000/ping';
    const statusElement = document.getElementById('status');
    const statusBox = document.getElementById('statusBox');
    const testButton = document.getElementById('testConnection');

    // Function to check server connection
    async function checkServerConnection() {
        try {
            const response = await fetch(serverUrl, { method: 'GET' });
            if (response.ok) {
                statusElement.textContent = 'Connected';
                statusBox.textContent = 'Server is running and connected!';
                statusBox.className = 'status connected';
            } else {
                throw new Error('Server returned non-OK response');
            }
        } catch (error) {
            statusElement.textContent = 'Disconnected';
            statusBox.textContent = 'Cannot connect to server. Make sure your Node.js server is running on http://localhost:3000';
            statusBox.className = 'status disconnected';
        }
    }

    // Check connection on popup open
    checkServerConnection();

    // Add listener for test button
    testButton.addEventListener('click', checkServerConnection);

    document.getElementById('testInjection').addEventListener('click', function() {
        // Query for the active Claude tab
        chrome.tabs.query({active: true, currentWindow: true, url: "*://*.claude.ai/*"}, function(tabs) {
            if (tabs.length > 0) {
                // Send message to content script
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "injectMessage",
                    message: "This is a test system message. Your calendar event was created successfully!"
                }, function(response) {
                    console.log("Injection result:", response);
                });
            } else {
                console.error("No active Claude tab found");
            }
        });
    });
});
