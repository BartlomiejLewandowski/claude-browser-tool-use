#!/bin/bash

# Test script for Claude API server
# Simulates a calendar event request

# Server URL
SERVER_URL="http://localhost:3003/claude-message"

# Calendar event as a single line with explicit escaping
CALENDAR_EVENT="<calendar><summary>Strategy Planning Meeting</summary><description>Quarterly planning</description><location>Conference Room A</location><start>2025-03-10T14:00:00Z</start><end>2025-03-10T15:30:00Z</end></calendar>"

# Current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Message ID
MESSAGE_ID="test-$(date +%s)"

# Create the JSON with no variables in the string itself
JSON_PAYLOAD="{\"message\":\"$CALENDAR_EVENT\",\"timestamp\":\"$TIMESTAMP\",\"messageId\":\"$MESSAGE_ID\"}"

# Send the request
echo "Sending calendar event request to server..."

curl -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  $SERVER_URL

echo -e "\n\nRequest sent. Check your server logs for details."
