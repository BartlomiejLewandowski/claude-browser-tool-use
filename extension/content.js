// Global variables
let systemMessage = null;
let messageIndicator = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 10;

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
    messageIndicator.appendChild(statusText);

    // Create button container (for alignment)
    const buttonContainer = document.createElement('div');
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
    if (!systemMessage) return false;

    try {
        // Find the input element using the specific data-placeholder attribute
        const inputElement = document.querySelector('[data-placeholder="Reply to Claude..."]');

        if (!inputElement) {
            console.error("Could not find Claude input element");
            alert("Could not find Claude's input field. Please try again or paste manually.");
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

        // Create the system message text
        const systemMessageText = `[System: ${systemMessage}]\n\n`;

        // Insert the system message at the beginning using execCommand
        document.execCommand('insertText', false, systemMessageText);

        // Clear the system message
        systemMessage = null;
        updateIndicatorStatus();

        return true;
    } catch (error) {
        console.error("Error pasting system message:", error);

        // Fallback: Copy to clipboard and alert user
        navigator.clipboard.writeText(`[System: ${systemMessage}]\n\n`)
            .then(() => {
                alert("System message copied to clipboard. Please paste it at the beginning of your message to Claude.");
                systemMessage = null;
                updateIndicatorStatus();
            })
            .catch(err => {
                alert("Could not paste system message. Please type: [System: " + systemMessage + "] at the beginning of your message.");
            });

        return false;
    }
}

// Update the indicator text based on whether a system message is queued
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
    let buttonContainer = messageIndicator.querySelector('div:not(.status-text)');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        messageIndicator.appendChild(buttonContainer);
    }

    // Clear existing buttons
    buttonContainer.innerHTML = '';

    if (systemMessage) {
        // Update text and style for active state
        statusText.textContent = `System message ready: "${systemMessage}"`;
        messageIndicator.style.backgroundColor = '#143d2b'; // Dark green
        messageIndicator.style.borderColor = '#1e5937'; // Darker green border

        // Add paste button
        const pasteButton = document.createElement('button');
        pasteButton.textContent = 'Paste Message';
        pasteButton.style.padding = '6px 12px';
        pasteButton.style.backgroundColor = '#238636';
        pasteButton.style.color = 'white';
        pasteButton.style.border = 'none';
        pasteButton.style.borderRadius = '4px';
        pasteButton.style.cursor = 'pointer';
        pasteButton.style.fontWeight = 'bold';
        pasteButton.style.marginLeft = '10px';

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
        clearButton.style.marginLeft = '8px';

        clearButton.onclick = function() {
            systemMessage = null;
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

// Listen for messages from the extension
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "injectMessage") {
        systemMessage = request.message;
        updateIndicatorStatus();
        sendResponse({status: "success"});
    }
});

// Start the initialization process
console.log("Claude API Listener content script loaded");
attemptInitialization();
