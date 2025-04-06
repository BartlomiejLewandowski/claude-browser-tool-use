// Modified content.js - Add this at the top
(() => {
    // Attempt to take ownership of the page by setting a token
    // Only the latest script instance should "win"
    const INSTANCE_TOKEN = Date.now();

    // Check if window has active token registry
    if (!window.__CLAUDE_ACTIVE_INSTANCES) {
        window.__CLAUDE_ACTIVE_INSTANCES = {};
    }

    // Register our instance
    window.__CLAUDE_ACTIVE_INSTANCES[INSTANCE_TOKEN] = true;

    // Determine the highest token (newest instance)
    const newestToken = Math.max(...Object.keys(window.__CLAUDE_ACTIVE_INSTANCES).map(Number));

    // If we're not the newest instance, don't initialize
    if (newestToken !== INSTANCE_TOKEN) {
        console.log(`Claude API Listener instance ${INSTANCE_TOKEN} is not the latest, skipping`);
        return; // Exit early and don't run the rest of the script
    }

    // We are the newest instance, proceed with initialization
    console.log(`Claude API Listener instance ${INSTANCE_TOKEN} is active`);



// Check if script is already loaded
if (typeof window.claudeListenerInitialized === 'undefined') {
    // Set flag to prevent multiple initializations
    window.claudeListenerInitialized = true;

    // Global variables
    let systemMessagesWithUUID = []; // Array of {message: string, messageUUID: string}
    let messageIndicator = null;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 10;
    let isPasting = false;

    // Add a flag to prevent recursive updates
    let isUpdating = false;

    // Try to initialize until we find the reference element or reach max attempts
    function attemptInitialization() {
        try {
            // Try to find the reference element
            const referenceElement = document.querySelectorAll('div[aria-label="Write your prompt to Claude"]')[0]
                ?.parentElement?.parentElement?.parentElement?.parentElement;

            if (referenceElement) {
                // Reference element found, create the indicator
                console.log("Reference element found, creating indicator");
                createPersistentIndicator(referenceElement);

                // Set up observer to ensure indicator persists
                setupObserver();
                return true;
            } else {
                console.log(`Attempt ${initAttempts + 1}/${MAX_INIT_ATTEMPTS}: Reference element not found yet`);
                initAttempts++;

                if (initAttempts < MAX_INIT_ATTEMPTS) {
                    // Try again in 1 second
                    setTimeout(attemptInitialization, 1000);
                } else {
                    console.warn("Max attempts reached. Using fallback indicator.");
                    createFallbackIndicator();
                }
                return false;
            }
        } catch (error) {
            console.error("Error during initialization:", error);
            initAttempts++;

            if (initAttempts < MAX_INIT_ATTEMPTS) {
                // Try again in 1 second
                setTimeout(attemptInitialization, 1000);
            } else {
                console.warn("Max attempts reached. Using fallback indicator.");
                createFallbackIndicator();
            }
            return false;
        }
    }

    // Set up mutation observer to ensure our indicator stays active
    function setupObserver() {
        const observer = new MutationObserver(function(mutations) {
            // Check if our indicator is still in the DOM
            if (!document.body.contains(messageIndicator)) {
                console.log("Indicator lost, attempting to recreate");
                attemptInitialization();
                return;
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Create a persistent indicator above the input area
    function createPersistentIndicator(referenceElement) {
        // First try to remove any existing indicator
        if (messageIndicator && document.body.contains(messageIndicator)) {
            messageIndicator.remove();
        }

        // Create new indicator element
        messageIndicator = document.createElement('div');
        messageIndicator.className = 'system-message-indicator';
        messageIndicator.style.padding = '8px 12px';
        messageIndicator.style.margin = '8px 0';
        messageIndicator.style.backgroundColor = '#2d333b'; // Dark background
        messageIndicator.style.color = '#e6edf3'; // Light text
        messageIndicator.style.border = '1px solid #444c56'; // Darker border
        messageIndicator.style.borderRadius = '6px';
        messageIndicator.style.fontSize = '14px';
        messageIndicator.style.zIndex = '1000';
        messageIndicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        messageIndicator.style.transition = 'background-color 0.3s';
        messageIndicator.style.width = '100%';
        messageIndicator.style.boxSizing = 'border-box';
        messageIndicator.style.display = 'flex';
        messageIndicator.style.justifyContent = 'space-between';
        messageIndicator.style.alignItems = 'center';

        // Create status text element
        const statusText = document.createElement('div');
        statusText.className = 'status-text';
        statusText.style.flexGrow = '1'; // Take up available space
        messageIndicator.appendChild(statusText);

        // Create button container with flex layout
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px'; // Space between buttons
        messageIndicator.appendChild(buttonContainer);

        // Set initial text and update status
        updateIndicatorStatus();

        // Get the parent of the reference element
        const parent = referenceElement.parentElement;

        // Insert the indicator before the reference element
        parent.insertBefore(messageIndicator, referenceElement);

        return messageIndicator;
    }

    // Create a fallback indicator if we can't find the reference element
    function createFallbackIndicator() {
        // First try to remove any existing indicator
        if (messageIndicator && document.body.contains(messageIndicator)) {
            messageIndicator.remove();
        }

        messageIndicator = document.createElement('div');
        messageIndicator.className = 'system-message-indicator';
        messageIndicator.style.padding = '8px 12px';
        messageIndicator.style.margin = '8px 0';
        messageIndicator.style.backgroundColor = '#2d333b'; // Dark background
        messageIndicator.style.color = '#e6edf3'; // Light text
        messageIndicator.style.border = '1px solid #444c56'; // Darker border
        messageIndicator.style.borderRadius = '6px';
        messageIndicator.style.fontSize = '14px';
        messageIndicator.style.position = 'fixed';
        messageIndicator.style.bottom = '20px';
        messageIndicator.style.right = '20px';
        messageIndicator.style.zIndex = '10000';
        messageIndicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        messageIndicator.style.display = 'flex';
        messageIndicator.style.justifyContent = 'space-between';
        messageIndicator.style.alignItems = 'center';
        messageIndicator.style.minWidth = '300px';

        // Create status text element
        const statusText = document.createElement('div');
        statusText.className = 'status-text';
        messageIndicator.appendChild(statusText);

        // Create button container (for alignment)
        const buttonContainer = document.createElement('div');
        messageIndicator.appendChild(buttonContainer);

        updateIndicatorStatus();
        document.body.appendChild(messageIndicator);

        return messageIndicator;
    }

    // Function to paste system message into the Claude input element
    function pasteSystemMessage() {
        if (systemMessagesWithUUID.length === 0 || isPasting) return false;

        try {
            isPasting = true;

            // Find the input element using the specific data-placeholder attribute
            const inputElement = document.querySelector('[data-placeholder="Reply to Claude..."]');

            if (!inputElement) {
                console.error("Could not find Claude input element");
                alert("Could not find Claude's input field. Please try again or paste manually.");
                isPasting = false;
                return false;
            }

            // Focus the input element
            inputElement.focus();

            // Assume this is a contenteditable element
            // Move cursor to the beginning
            const selection = window.getSelection();
            const range = document.createRange();

            // Check if the element has any child nodes
            if (inputElement.firstChild) {
                range.setStart(inputElement.firstChild, 0);
            } else {
                range.setStart(inputElement, 0);
            }

            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);

            // Create combined system message text with all messages
            let systemMessageText = '';
            systemMessagesWithUUID.forEach(msgObj => {
                systemMessageText += `[System: ${msgObj.message}]\n`;
            });
            systemMessageText += '\n'; // Add final newline

            // Insert the system message at the beginning using execCommand
            document.execCommand('insertText', false, systemMessageText);

            // Store message UUIDs to acknowledge them on send
            const messageUUIDs = systemMessagesWithUUID.map(msgObj => msgObj.messageUUID);

            // Clear the system messages
            systemMessagesWithUUID = [];
            updateIndicatorStatus();

            isPasting = false;
            return true;
        } catch (error) {
            console.error("Error pasting system message:", error);
            isPasting = false;

            // Fallback: Copy to clipboard and alert user
            let combinedMessage = '';
            systemMessagesWithUUID.forEach(msgObj => {
                combinedMessage += `[System: ${msgObj.message}]\n`;
            });
            combinedMessage += '\n';

            navigator.clipboard.writeText(combinedMessage)
                .then(() => {
                    alert("System messages copied to clipboard. Please paste at the beginning of your message to Claude.");
                    systemMessagesWithUUID = [];
                    updateIndicatorStatus();
                })
                .catch(err => {
                    alert("Could not paste system messages. Please type them manually at the beginning of your message.");
                });

            return false;
        }
    }

    // Update the updateIndicatorStatus function to handle messages with UUIDs
    function updateIndicatorStatus() {
        if (!messageIndicator || isUpdating) return;

        isUpdating = true;

        // Get or create the status text element
        let statusText = messageIndicator.querySelector('.status-text');
        if (!statusText) {
            statusText = document.createElement('div');
            statusText.className = 'status-text';
            messageIndicator.appendChild(statusText);
        }

        // Get or create the button container
        let buttonContainer = messageIndicator.querySelector('.button-container');
        if (!buttonContainer) {
            buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '8px'; // Space between buttons
            messageIndicator.appendChild(buttonContainer);
        }

        // Clear existing buttons
        buttonContainer.innerHTML = '';

        if (systemMessagesWithUUID.length > 0) {
            // Update text and style for active state
            if (systemMessagesWithUUID.length === 1) {
                statusText.textContent = `System message ready: "${systemMessagesWithUUID[0].message}"`;
            } else {
                statusText.textContent = `${systemMessagesWithUUID.length} system messages ready`;
            }

            messageIndicator.style.backgroundColor = '#143d2b'; // Dark green
            messageIndicator.style.borderColor = '#1e5937'; // Darker green border

            // Add paste button
            const pasteButton = document.createElement('button');
            pasteButton.textContent = 'Paste Messages';
            pasteButton.style.padding = '6px 12px';
            pasteButton.style.backgroundColor = '#238636';
            pasteButton.style.color = 'white';
            pasteButton.style.border = 'none';
            pasteButton.style.borderRadius = '4px';
            pasteButton.style.cursor = 'pointer';
            pasteButton.style.fontWeight = 'bold';

            pasteButton.onclick = function() {
                pasteSystemMessage();
            };

            buttonContainer.appendChild(pasteButton);

            // Add clear button
            const clearButton = document.createElement('button');
            clearButton.textContent = 'Clear';
            clearButton.style.padding = '6px 12px';
            clearButton.style.backgroundColor = 'transparent';
            clearButton.style.color = '#e6edf3';
            clearButton.style.border = '1px solid #e6edf3';
            clearButton.style.borderRadius = '4px';
            clearButton.style.cursor = 'pointer';

            clearButton.onclick = function() {
                systemMessagesWithUUID = [];
                updateIndicatorStatus();
            };

            buttonContainer.appendChild(clearButton);
        } else {
            // Update text and style for inactive state
            statusText.textContent = 'No system messages queued';
            messageIndicator.style.backgroundColor = '#2d333b'; // Default dark
            messageIndicator.style.borderColor = '#444c56'; // Default dark border
        }
        isUpdating = false;
    }


    // Add event listener for Enter key to acknowledge tasks
    function setupEnterKeyListener() {
        console.log("Setting up Enter key listener");

        // Find the Claude input field
        const inputField = document.querySelector('[data-placeholder="Reply to Claude..."]');

        if (!inputField) {
            console.warn("Could not find Claude input field, retrying in 2 seconds");
            setTimeout(setupEnterKeyListener, 2000);
            return;
        }

        // Add a keydown event listener to the input field
        inputField.addEventListener('keydown', function(event) {
            // Check if the key pressed is Enter and not Shift+Enter
            if (event.key === 'Enter' && !event.shiftKey) {
                // Clear system messages after sending
                systemMessagesWithUUID = [];
                updateIndicatorStatus();
            }
        });

        console.log("Enter key listener set up successfully");
    }

    // Update the listener for messages from the extension
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "injectMessage") {
            // Add message with UUID to the queue
            systemMessagesWithUUID.push({
                message: request.message,
                messageUUID: request.messageUUID
            });
            chrome.runtime.sendMessage({
                action: 'acknowledgeTask',
                messageUUID: request.messageUUID
            })
            updateIndicatorStatus();
            sendResponse({status: "success"});
        }
        return true; // Keep the message channel open for async responses
    });

    // Call the setup function after initialization
    console.log("Claude API Listener content script loaded");
    attemptInitialization();
    // Set up the Enter key listener after initialization
    setTimeout(setupEnterKeyListener, 2000);
} else {
    console.log("Claude API Listener content script already loaded, skipping initialization");
}
    // Rest of your content script goes here
    // ... existing code ...
})();
