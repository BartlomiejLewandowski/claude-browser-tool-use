// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Google API Setup
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    // Add other Google API scopes as needed
];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

/**
 * Get and store new token after prompting for user authorization
 */
async function getAccessToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve, reject) => {
        rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    reject('Error retrieving access token: ' + err);
                    return;
                }
                oAuth2Client.setCredentials(token);
                fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                    if (err) console.error(err);
                    console.log('Token stored to', TOKEN_PATH);
                });
                resolve(oAuth2Client);
            });
        });
    });
}

/**
 * Create an OAuth2 client using credentials and token.json
 */
async function authorize() {
    try {
        const content = await fs.promises.readFile(CREDENTIALS_PATH);
        const credentials = JSON.parse(content);
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        try {
            const token = await fs.promises.readFile(TOKEN_PATH);
            oAuth2Client.setCredentials(JSON.parse(token));
            return oAuth2Client;
        } catch (err) {
            return getAccessToken(oAuth2Client);
        }
    } catch (err) {
        console.error('Error loading client secret file:', err);
        throw err;
    }
}

/**
 * Add event to Google Calendar
 */
async function addCalendarEvent(auth, eventDetails) {
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: eventDetails,
        });

        console.log('Event created: %s', response.data.htmlLink);
        return response.data;
    } catch (err) {
        console.error('Error creating calendar event:', err);
        throw err;
    }
}

/**
 * Extract XML tag content from message
 */
function extractXmlContent(message, tagName) {
    const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's');
    const match = message.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * Parse calendar event details from XML content
 */
function parseCalendarEvent(calendarXml) {
    // This is a simplified parser - you may want to use a proper XML parser
    const summary = extractXmlContent(calendarXml, 'summary') || 'New Event';
    const description = extractXmlContent(calendarXml, 'description') || '';
    const location = extractXmlContent(calendarXml, 'location') || '';
    const startTime = extractXmlContent(calendarXml, 'start') || new Date().toISOString();
    const endTime = extractXmlContent(calendarXml, 'end') || new Date(Date.now() + 3600000).toISOString();

    return {
        summary,
        description,
        location,
        start: {
            dateTime: startTime,
            timeZone: 'America/Los_Angeles', // Default timezone, adjust as needed
        },
        end: {
            dateTime: endTime,
            timeZone: 'America/Los_Angeles', // Default timezone, adjust as needed
        }
    };
}

// Routes
app.get('/ping', (req, res) => {
    res.status(200).send({ status: 'ok', message: 'Server is running' });
});

app.post('/claude-message', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).send({ error: 'No message content provided' });
    }

    console.log('Received message from Claude:', message);

    try {
        // Check for different XML tags and process accordingly
        if (message.includes('<calendar>')) {
            const calendarContent = extractXmlContent(message, 'calendar');
            if (calendarContent) {
                console.log('Calendar event detected:', calendarContent);

                const eventDetails = parseCalendarEvent(calendarContent);
                console.log('Parsed event details:', eventDetails);

                try {
                    const auth = await authorize();
                    const result = await addCalendarEvent(auth, eventDetails);

                    console.log('Event created successfully');
                    return res.status(200).send({
                        status: 'success',
                        type: 'calendar',
                        result,
                        injectMessage: "Calendar event created successfully! Event added to your primary calendar."
                    });
                } catch (error) {
                    console.error('Failed to create calendar event:', error);
                    return res.status(500).send({
                        status: 'error',
                        type: 'calendar',
                        error: error.message,
                        injectMessage: "Failed to create calendar event. Ask user to retry."

                    });
                }
            }
        }
        // Add more tag handlers here for different functionality
        else if (message.includes('<email>')) {
            const emailContent = extractXmlContent(message, 'email');
            console.log('Email action detected:', emailContent);
            // Implement email sending logic here
            return res.status(200).send({
                status: 'success',
                type: 'email',
                message: 'Email processing not implemented yet'
            });
        }
        else if (message.includes('<todo>')) {
            const todoContent = extractXmlContent(message, 'todo');
            console.log('Todo action detected:', todoContent);
            // Implement todo list logic here
            return res.status(200).send({
                status: 'success',
                type: 'todo',
                message: 'Todo processing not implemented yet'
            });
        }
        // If no known tags are found
        else {
            console.log('No actionable tags found in message');
            return res.status(200).send({
                status: 'success',
                type: 'unknown',
                message: 'No actionable tags found in message'
            });
        }
    } catch (error) {
        console.error('Error processing message:', error);
        return res.status(500).send({
            status: 'error',
            message: 'Failed to process message',
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test the server: http://localhost:${PORT}/ping`);
});
