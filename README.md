# Claude Pro Tool-Use within Conversations

This project is a Chrome extension tied with a node.js server that allows users to add tools which can be used by Claude.

## How it works

- The content script is injected onto the claude.ai/chat page, which shows an indicator containing "system" messages. These will come as results from operations performed on the server side (by using tools provided there).
- A background script listens for all messages sent back from Claude. It sends them to the server, which processes the message and if there is a tool required, it will perform the operation. Once the operation is complete, it will notify the content script, which store the result in a system message.
- The server listening to requests from the background script. You can extend the functionality with more tools there.

## Why?

It's a PoC, I just got a Claude Pro subscription, but noticed that tool use (as in the API) is not available. So I tried collaborating with Claude to see if we can make it work quickly. Many errors were faced along the way, but I was able to guide Claude in the right direction.

## TODO?

- [ ] Add more tools (I want to have the ability to read my emails.)
- [ ] Test the google calendar tool integration e2e
