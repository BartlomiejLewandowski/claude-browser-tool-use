import {registerTool} from "./registry";
import {extractXmlContent} from "./utils";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {google} from "googleapis";

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');

// Google API Setup
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    // Add other Google API scopes as needed
];

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
        const credentials = JSON.parse(content as unknown as string);
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

        try {
            const token = await fs.promises.readFile(TOKEN_PATH);
            oAuth2Client.setCredentials(JSON.parse(token as unknown as string));
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
 * Parse calendar event details from XML content
 */
function parseCalendarEvent(calendarXml: string) {
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


/**
 * Add event to Google Calendar
 */
async function addCalendarEvent(auth, eventDetails) {
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        // @ts-ignore
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: eventDetails,
        });

        // @ts-ignore
        console.log('Event created: %s', response.data.htmlLink);
        // @ts-ignore
        return response.data;
    } catch (err) {
        console.error('Error creating calendar event:', err);
        throw err;
    }
}

registerTool({
    async run(messageContent: string) {
        const calendarContent = extractXmlContent(messageContent, 'calendar');
        if (calendarContent) {
            console.log('Calendar event detected:', calendarContent);

            const eventDetails = parseCalendarEvent(calendarContent);
            console.log('Parsed event details:', eventDetails);

                const auth = await authorize();
                const result = await addCalendarEvent(auth, eventDetails);

                console.log('Event created successfully');

                return result;
        }
    },
    getTagName: () => 'calendar'})
