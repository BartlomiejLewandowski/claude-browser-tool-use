// Background script for Claude Stream Capturer - Simple and focused
const SERVER_URL = 'http://localhost:3003/claude-stream';
let debuggedTabId = null;
let activeStreams = {};

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
      attachDebugger(claudeTab.id);
    } else {
      console.log("No Claude tabs found. Will try again when a tab is updated.");
    }
  });
}

// Attach debugger to a tab
function attachDebugger(tabId) {
  if (debuggedTabId === tabId) return;

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
      return;
    }

    debuggedTabId = tabId;
    console.log("Debugger attached to tab:", tabId);

    // Enable network monitoring
    chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable", {});
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
        if (chrome.runtime.lastError || !response || !response.body) return;

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
    // Extract text from content_block_delta events
    let newText = "";
    for (const event of newEvents) {
      if (event.type === "content_block_delta" &&
          event.data.delta?.type === "text_delta") {
        newText += event.data.delta.text;
      }
    }

    // Add to accumulated text if there's new content
    if (newText) {
      stream.accumulated += newText;
      stream.events = events;

      // Send the new content to the server
      sendToServer(
          stream.conversationId,
          newText,
          stream.accumulated,
          stream.messageUuid || "unknown", // Include the message UUID
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

    // Clean up
    delete activeStreams[requestId];
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

  xhr.send(JSON.stringify({
    conversationId: conversationId,
    messageUuid: messageUuid,  // This is the current_leaf_message_uuid
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
    if (!debuggedTabId) {
      attachDebugger(tabId);
    }
  }
});

// If the debugged tab is closed, find another Claude tab
chrome.tabs.onRemoved.addListener(function(tabId) {
  if (tabId === debuggedTabId) {
    debuggedTabId = null;
    findAndAttachToClaudeTab();
  }
});

function injectSystemMessage(message) {
  // Find all Claude tabs
  chrome.tabs.query({url: "*://*.claude.ai/*"}, function(tabs) {
    if (tabs.length > 0) {
      // Send the message to each tab
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'injectMessage',
          message: message
        }, function(response) {
          console.log('Injection response:', response);
        });
      });
      console.log('Sent system message to', tabs.length, 'Claude tabs');
    } else {
      console.log('No Claude tabs found to inject message');
    }
  });
}


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'injectSystemMessage' && request.message) {
    injectSystemMessage(request.message);
    sendResponse({status: 'success'});
    return true;
  }
});
