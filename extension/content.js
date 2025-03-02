// Global variables
let systemMessage = null;
let messageIndicator = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 10;

// Try to initialize until we find the reference element or reach max attempts
function attemptInitialization() {
    try {
        // Try to find the reference element
        const referenceElement = document.querySelectorAll('div[aria-label="Write your prompt to Claude"]')[0]
            ?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;

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
        }

        // Also check if we need to update the status
        if (messageIndicator) {
            updateIndicatorStatus();
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

    // Set initial text
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
    messageIndicator.style.backgroundColor = '#f0f7ff';
    messageIndicator.style.border = '1px solid #c0d7ff';
    messageIndicator.style.borderRadius = '6px';
    messageIndicator.style.fontSize = '14px';
    messageIndicator.style.position = 'fixed';
    messageIndicator.style.bottom = '20px';
    messageIndicator.style.right = '20px';
    messageIndicator.style.zIndex = '10000';
    messageIndicator.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';

    updateIndicatorStatus();
    document.body.appendChild(messageIndicator);

    return messageIndicator;
}

// Update the indicator text based on whether a system message is queued
function updateIndicatorStatus() {
    if (!messageIndicator) return;

    if (systemMessage) {
        messageIndicator.textContent = `System message ready: "${systemMessage}"`;
        messageIndicator.style.backgroundColor = '#143d2b'; // Dark green
        messageIndicator.style.borderColor = '#1e5937'; // Darker green border
    } else {
        messageIndicator.textContent = 'No system messages queued';
        messageIndicator.style.backgroundColor = '#2d333b'; // Default dark
        messageIndicator.style.borderColor = '#444c56'; // Default dark border
    }
}
// Listen for messages from the extension
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "injectMessage") {
        systemMessage = request.message;
        injectSystemMessage(request.message);
        updateIndicatorStatus();
        sendResponse({status: "success"});
    }
});

// Function to intercept the next user message and prepend system information
function injectSystemMessage(message) {
    // Find the input field
    const inputField = document.querySelector('textarea[placeholder="Message Claude..."]');

    if (!inputField) {
        console.error("Could not find input field");
        return false;
    }

    // Create a wrapper for the original input handler
    const originalHandler = inputField.onkeydown;

    // Override the input handler
    inputField.onkeydown = function(e) {
        // Check if this is a message submission (Enter without Shift)
        if (e.key === 'Enter' && !e.shiftKey && systemMessage) {
            // Get the user's message
            const userMessage = inputField.value;

            // Only prepend if there's no system message already
            if (!userMessage.startsWith('[System:')) {
                // Prepend system information
                inputField.value = `[System: ${systemMessage}]\n\n${userMessage}`;

                // Clear the stored system message after using it
                systemMessage = null;

                // Update the indicator
                setTimeout(() => {
                    updateIndicatorStatus();
                }, 200);
            }
        }

        // Call the original handler
        if (originalHandler) {
            return originalHandler.call(this, e);
        }
    };

    return true;
}

// Start the initialization process
console.log("Claude API Listener content script loaded");
attemptInitialization();
