#!/bin/bash

# Test script for Claude Stream Capturer
# Simulates a complete message with calendar XML

# Server URL
SERVER_URL="http://localhost:3003/claude-stream"

# Calendar event as a single line with explicit escaping
CALENDAR_EVENT="<calendar><summary>Strategy Planning Meeting</summary><description>Quarterly planning</description><location>Conference Room A</location><start>2025-03-10T14:00:00Z</start><end>2025-03-10T15:30:00Z</end></calendar>"

# Current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Conversation and message IDs
CONVERSATION_ID="test-convo-$(date +%s)"
MESSAGE_UUID="test-msg-$(date +%s)"

# Create the JSON payload to simulate a complete message
JSON_PAYLOAD="{
  \"conversationId\": \"$CONVERSATION_ID\",
  \"messageUuid\": \"$MESSAGE_UUID\",
  \"newText\": \"\",
  \"fullText\": \"$CALENDAR_EVENT\",
  \"isComplete\": true,
  \"timestamp\": \"$TIMESTAMP\"
}"

# Send the request
echo "Sending simulated complete message with calendar event to server..."

curl -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  $SERVER_URL
