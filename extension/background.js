// Background script for Claude API Listener - Minimal version
const SERVER_URL = 'http://localhost:3003/claude-message';
let debuggedTabId = null;

// Initialize debugging on installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('Claude API Listener extension installed');
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
  // Don't reattach if already attached to this tab
  if (debuggedTabId === tabId) {
    console.log("Debugger already attached to tab:", tabId);
    return;
  }

  // Detach from previous tab if needed
  if (debuggedTabId) {
    chrome.debugger.detach({ tabId: debuggedTabId }, function() {
      console.log("Detached from previous tab:", debuggedTabId);
      // Now attach to the new tab
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

    console.log("Debugger attached to tab:", tabId);
    debuggedTabId = tabId;

    // Enable network monitoring
    chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable", {}, function() {
      if (chrome.runtime.lastError) {
        console.error("Failed to enable network:", chrome.runtime.lastError);
        return;
      }
      console.log("Network monitoring enabled");
    });
  });
}

// Listen for debugger events
chrome.debugger.onEvent.addListener(function(source, method, params) {
  // Only process events from our debugged tab
  if (source.tabId !== debuggedTabId) return;

  // Log all events to help with debugging
  console.log("Debugger event:", method);

  if (method === "Network.responseReceived") {
    console.log("Response received:", params.requestId, params.response.url);

    // Check if this is a Claude API response
    if (params.response.url.includes("claude.ai/api/") && params.response.url.includes("completion")) {
      console.log("Claude API response detected!");

      // Get response body
      chrome.debugger.sendCommand(
          { tabId: source.tabId },
          "Network.getResponseBody",
          { "requestId": params.requestId },
          function(response) {
            if (chrome.runtime.lastError) {
              console.error("Error getting response body:", chrome.runtime.lastError);
              return;
            }

            if (!response || !response.body) {
              console.log("No response body available");
              return;
            }

            console.log("Response body length:", response.body.length);
            console.log("Response sample:", response.body.substring(0, 200));

            // Simple forwarding to server
            const xhr = new XMLHttpRequest();
            xhr.open('POST', SERVER_URL, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = function() {
              if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                  try {
                    const response = JSON.parse(xhr.responseText);

                    // Check if there's a message to inject
                    if (response.injectMessage) {
                      // Find all Claude tabs and inject the message
                      chrome.tabs.query({url: "*://*.claude.ai/*"}, function(tabs) {
                        if (tabs.length > 0) {
                          // Send the message to each tab
                          tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, {
                              action: 'injectMessage',
                              message: response.injectMessage
                            }, function(response) {
                              console.log('Injection response:', response);
                            });
                          });
                          console.log('Sent message to', tabs.length, 'Claude tabs');
                        } else {
                          console.log('No Claude tabs found to inject message');
                        }
                      });
                    }
                  } catch (e) {
                    console.error("Error parsing server response:", e);
                  }
                }
              }
            };
            xhr.send(JSON.stringify({
              message: response.body,
              url: params.response.url,
              timestamp: new Date().toISOString()
            }));
          }
      );
    }
  }
});

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
    console.log("Debugged tab was closed, finding another Claude tab");
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
