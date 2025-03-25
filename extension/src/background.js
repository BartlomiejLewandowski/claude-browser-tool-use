// Background script for Claude Stream Capturer - Enhanced with resilience
const SERVER_URL = 'http://localhost:3003/claude-stream';
let debuggedTabId = null;
let activeStreams = {};
let debuggerActive = false;
let lastKnownClaudeTabId = null;

// Initialize debugging on installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('Claude Stream Capturer installed');
  findAndAttachToClaudeTab();
});

// Find the first Claude tab and attach to it
function findAndAttachToClaudeTab() {
  chrome.tabs.query({ url: "*://*.claude.ai/*" }, function(tabs) {
    if (tabs.length > 0) {
      const claudeTab = tabs[0];
      console.log("Found Claude tab:", claudeTab.id, claudeTab.url);
      lastKnownClaudeTabId = claudeTab.id;
      attachDebugger(claudeTab.id);
    } else {
      console.log("No Claude tabs found. Will try again when a tab is updated.");
    }
  });
}

// Attach debugger to a tab
function attachDebugger(tabId) {
  if (debuggedTabId === tabId && debuggerActive) return;

  if (debuggedTabId) {
    chrome.debugger.detach({ tabId: debuggedTabId }, function() {
      actuallyAttach(tabId);
    });
  } else {
    actuallyAttach(tabId);
  }
}

function actuallyAttach(tabId) {
  chrome.debugger.attach({ tabId: tabId }, "1.0", function() {
    if (chrome.runtime.lastError) {
      console.error("Failed to attach debugger:", chrome.runtime.lastError);
      debuggerActive = false;

      // Inform the user about the debugging issue
      notifyDebuggerStatus(tabId, false);

      return;
    }

    debuggedTabId = tabId;
    debuggerActive = true;
    console.log("Debugger attached to tab:", tabId);

    // Notify content script that debugger is connected
    notifyDebuggerStatus(tabId, true);

    // Enable network monitoring
    chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable", {});
  });
}

// Notify content script about debugger status
function notifyDebuggerStatus(tabId, isConnected) {
  chrome.tabs.sendMessage(tabId, {
    action: "debuggerStatus",
    isConnected: isConnected,
    message: isConnected
        ? "Debugger connected successfully"
        : "Debugger disconnected. Claude tools may not work properly. Click to reconnect."
  }, function(response) {
    if (chrome.runtime.lastError) {
      console.log("Error sending debugger status:", chrome.runtime.lastError);

      // Content script might not be loaded yet, try injecting it
      chrome.tabs.executeScript(tabId, {file: "src/content.js"}, function() {
        if (chrome.runtime.lastError) {
          console.error("Failed to inject content script:", chrome.runtime.lastError);
        } else {
          // Try sending the message again after script is injected
          setTimeout(() => notifyDebuggerStatus(tabId, isConnected), 500);
        }
      });
    }
  });
}

// Listen for debugger events
chrome.debugger.onEvent.addListener(function(source, method, params) {
  // Only process events from our debugged tab
  if (source.tabId !== debuggedTabId) return;

  // Handle response received event
  if (method === "Network.responseReceived") {
    const url = params.response.url;

    // Only focus on completion endpoint
    if (isCompletionEndpoint(url)) {
      console.log("Claude completion stream detected:", params.requestId);

      // Initialize this stream in our tracking object
      activeStreams[params.requestId] = {
        url: url,
        conversationId: extractConversationId(url),
        accumulated: "",
        messageUuid: null, // Will be populated from message_start event
        events: []
      };
    }
  }

  // Handle data received events for streaming responses
  if (method === "Network.dataReceived" && activeStreams[params.requestId]) {
    // Each time we receive data, get the full response body so far
    getResponseBody(source.tabId, params.requestId);
  }

  // Clean up when loading finishes
  if (method === "Network.loadingFinished" && activeStreams[params.requestId]) {
    // Get one final snapshot of the complete response
    getResponseBody(source.tabId, params.requestId, true);
  }
});

// Listen for debugger detached events (e.g., when user clicks "Cancel")
chrome.debugger.onDetach.addListener(function(source) {
  if (source.tabId === debuggedTabId) {
    console.log("Debugger detached from tab:", debuggedTabId);
    debuggerActive = false;

    // Notify the user that the debugger was disconnected
    notifyDebuggerStatus(debuggedTabId, false);
  }
});

// Check if URL is a Claude completion endpoint
function isCompletionEndpoint(url) {
  return url.includes("claude.ai/api/") &&
      url.includes("chat_conversations") &&
      url.includes("completion");
}

// Extract conversation ID from URL
function extractConversationId(url) {
  const match = url.match(/chat_conversations\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : "unknown";
}

// Get the response body and process it
function getResponseBody(tabId, requestId, isComplete = false) {
  chrome.debugger.sendCommand(
      { tabId: tabId },
      "Network.getResponseBody",
      { "requestId": requestId },
      function(response) {
        if (chrome.runtime.lastError) {
          console.error("Error getting response body:", chrome.runtime.lastError);
          // Check if the debugger was detached
          if (chrome.runtime.lastError.message.includes("Debugger is not attached")) {
            debuggerActive = false;
            notifyDebuggerStatus(tabId, false);
          }
          return;
        }

        if (!response || !response.body) return;

        processEventStream(requestId, response.body, isComplete);
      }
  );
}

// Process the event stream data
function processEventStream(requestId, body, isComplete) {
  if (!activeStreams[requestId]) return;

  const stream = activeStreams[requestId];
  const events = parseEventStream(body);

  // Find any new events we haven't processed yet
  const newEvents = events.slice(stream.events.length);

  // Extract message UUID from message_start event if we haven't already
  if (!stream.messageUuid && events.length > 0) {
    const messageStartEvent = events.find(event => event.type === "message_start");
    if (messageStartEvent && messageStartEvent.data.message?.uuid) {
      stream.messageUuid = messageStartEvent.data.message.uuid;
      console.log("Found message UUID:", stream.messageUuid);
    }
  }

  if (newEvents.length > 0) {
    // Track both text content and artifact content
    let newText = "";
    let newArtifactContent = "";

    for (const event of newEvents) {
      // Process regular text content
      if (event.type === "content_block_delta" &&
          event.data.delta?.type === "text_delta") {
        newText += event.data.delta.text;
      }

      // Process artifact content (input_json_delta)
      if (event.type === "content_block_delta" &&
          event.data.delta?.type === "input_json_delta") {
        // Store artifact content
        newArtifactContent += event.data.delta.partial_json;

        // Try to extract XML content from JSON if possible
        // This is a simple heuristic - it looks for XML patterns in the JSON
        if (event.data.delta.partial_json.includes("<") &&
            event.data.delta.partial_json.includes(">")) {
          console.log("Detected potential XML in artifact:",
              event.data.delta.partial_json);
        }
      }
    }

    // Combine all new content
    const combinedNewContent = newText + (newArtifactContent ? "\n" + newArtifactContent : "");

    // Add to accumulated text if there's any new content
    if (combinedNewContent) {
      // For artifact content, we're just appending it for now - in a more
      // sophisticated implementation you might want to parse it properly
      stream.accumulated += combinedNewContent;
      stream.events = events;

      // Send the combined new content to the server
      sendToServer(
          stream.conversationId,
          combinedNewContent,
          stream.accumulated,
          stream.messageUuid || "unknown",
          false // Not complete yet
      );
    }
  }

  // Always send a final message when complete, regardless of new content
  if (isComplete) {
    console.log("Stream complete:", requestId);

    // Send the final complete message
    sendToServer(
        stream.conversationId,
        "", // No new text
        stream.accumulated,
        stream.messageUuid || "unknown",
        true // Mark as complete
    );

    // Don't delete the stream immediately to allow for potential DOM inspection
    setTimeout(() => {
      delete activeStreams[requestId];
    }, 2000);
  }
}

// Parse an event stream (SSE) format string into an array of events
function parseEventStream(body) {
  const events = [];
  const eventChunks = body.split("\n\n");

  for (const chunk of eventChunks) {
    if (!chunk.trim()) continue;

    const lines = chunk.split("\n");
    let eventType = "";
    let eventData = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.substring(7);
      } else if (line.startsWith("data: ")) {
        eventData = line.substring(6);
      }
    }

    if (eventType && eventData) {
      try {
        const data = JSON.parse(eventData);
        events.push({
          type: eventType,
          data: data
        });
      } catch (e) {
        console.error("Error parsing event data:", e);
      }
    }
  }

  return events;
}

// Send data to your server
function sendToServer(conversationId, newText, fullText, messageUuid, isComplete) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', SERVER_URL, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onerror = function() {
    console.error("Error sending data to server. Make sure the server is running.");
  };

  xhr.send(JSON.stringify({
    conversationId: conversationId,
    messageUuid: messageUuid,
    newText: newText,
    fullText: fullText,
    isComplete: isComplete,
    timestamp: new Date().toISOString()
  }));
}

// Watch for tab updates to find Claude tabs
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes("claude.ai")) {
    console.log("Claude tab updated:", tabId);
    lastKnownClaudeTabId = tabId;

    if (!debuggerActive || debuggedTabId !== tabId) {
      attachDebugger(tabId);
    }
  }
});

// If the debugged tab is closed, find another Claude tab
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabId === debuggedTabId) {
    debuggedTabId = null;
    debuggerActive = false;
    findAndAttachToClaudeTab();
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'acknowledgeTask' && request.messageUUID) {
    acknowledgeTask(request.messageUUID);
    sendResponse({status: 'success'});
    return true;
  }

  if (request.action === 'reconnectDebugger') {
    console.log("Reconnecting debugger by user request");
    if (lastKnownClaudeTabId) {
      attachDebugger(lastKnownClaudeTabId);
      sendResponse({status: 'attempting'});
    } else {
      findAndAttachToClaudeTab();
      sendResponse({status: 'searching'});
    }
    return true;
  }

  if (request.action === 'checkDebuggerStatus') {
    sendResponse({
      isConnected: debuggerActive,
      tabId: debuggedTabId
    });
    return true;
  }
});

const SERVER_TASKS_URL = 'http://localhost:3003/unacknowledged-tasks';
const TASK_ACKNOWLEDGE_URL = 'http://localhost:3003/acknowledge-task';
const POLLING_INTERVAL = 5000; // Poll every 5 seconds

// Initialize task polling
initTaskPolling();

// Function to poll for unacknowledged tasks
function initTaskPolling() {
  console.log('Initializing task polling');
  // Start polling
  pollForTasks();
  // Set up interval for polling
  setInterval(pollForTasks, POLLING_INTERVAL);
}

// Poll the server for unacknowledged tasks
function pollForTasks() {
  // Check if we have any active Claude tabs to send tasks to
  chrome.tabs.query({ url: "*://*.claude.ai/*" }, function(tabs) {
    if (tabs.length === 0) {
      // No Claude tabs open, no need to poll for tasks
      return;
    }

    // Get the conversation ID from the URL
    const tab = tabs[0];
    const url = new URL(tab.url);
    const pathParts = url.pathname.split('/');
    const conversationIndex = pathParts.indexOf('chat') + 1;

    if (conversationIndex >= pathParts.length || !pathParts[conversationIndex]) {
      // No valid conversation ID in the URL
      console.log('No valid conversation ID found in URL:', url.pathname);
      return;
    }

    const conversationId = pathParts[conversationIndex];

    // Poll for tasks for this conversation
    fetchUnacknowledgedTasks(conversationId, tab.id);
  });
}

// Fetch unacknowledged tasks from the server
function fetchUnacknowledgedTasks(conversationId, tabId) {
  fetch(`${SERVER_TASKS_URL}/${conversationId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.status === 'success' && data.tasks && data.tasks.length > 0) {
          console.log(`Found ${data.tasks.length} unacknowledged tasks`);

          // Send each task to the content script
          data.tasks.forEach(task => {
            sendTaskToContentScript(tabId, task);
          });
        }
      })
      .catch(error => {
        console.error('Error polling for tasks:', error);
      });
}

// Send a task to the content script for display
function sendTaskToContentScript(tabId, task) {
  const message = task.result && task.result.message ? task.result.message : 'Task completed';

  chrome.tabs.sendMessage(tabId, {
    action: 'injectMessage',
    message: message,
    messageUUID: task.message_uuid
  }, function(response) {
    if (response && response.status === 'success') {
      console.log('System message injected successfully for task', task.message_uuid);
    } else {
      console.error('Failed to inject system message for task', task.message_uuid);
    }
  });
}

// Acknowledge a task on the server
function acknowledgeTask(messageUUID) {
  fetch(`${TASK_ACKNOWLEDGE_URL}/${messageUUID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ acknowledged: true })
  })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.status === 'success') {
          console.log(`Task ${messageUUID} acknowledged successfully`);
        } else {
          console.error(`Failed to acknowledge task ${messageUUID}:`, data.message);
        }
      })
      .catch(error => {
        console.error(`Error acknowledging task ${messageUUID}:`, error);
      });
}
