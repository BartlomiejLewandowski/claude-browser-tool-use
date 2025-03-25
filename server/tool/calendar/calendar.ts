import {registerTool} from "../registry";
import {extractXmlContent} from "../utils";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {google} from "googleapis";
import {Tool, ToolResult, ToolSetupState, ToolSetupStatus} from "../tool";

class CalendarTool implements Tool {
    private CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
    private TOKEN_PATH = path.join(__dirname, 'token.json');
    private SCOPES = [
        'https://www.googleapis.com/auth/calendar',
        // Add other Google API scopes as needed
    ];

    getTagName(): string {
        return 'calendar';
    }

    async checkSetupStatus(): Promise<ToolSetupStatus> {
        // Check if credentials file exists
        const hasCredentials = fs.existsSync(this.CREDENTIALS_PATH);
        // Check if token file exists
        const hasToken = fs.existsSync(this.TOKEN_PATH);

        if (!hasCredentials) {
            return {
                state: ToolSetupState.REGISTERED,
                credentialsPath: this.CREDENTIALS_PATH,
                additionalInfo: 'Missing Google API credentials'
            };
        } else if (!hasToken) {
            return {
                state: ToolSetupState.CONFIGURED,
                credentialsPath: this.CREDENTIALS_PATH,
                tokenPath: this.TOKEN_PATH,
                additionalInfo: 'Credentials present but not authenticated'
            };
        } else {
            return {
                state: ToolSetupState.AUTHENTICATED,
                credentialsPath: this.CREDENTIALS_PATH,
                tokenPath: this.TOKEN_PATH,
                additionalInfo: 'Ready to use'
            };
        }
    }

    async setupCredentials(): Promise<boolean> {
        console.log('\nSetting up Google Calendar credentials');
        console.log('====================================');
        console.log('\n1. Go to Google Developer Console: https://console.developers.google.com/');
        console.log('2. Create a new project or select an existing one');
        console.log('3. Enable the Google Calendar API');
        console.log('4. Create OAuth credentials (Desktop application)');
        console.log('5. Download the credentials JSON file');
        console.log(`6. Save this file to: ${this.CREDENTIALS_PATH}`);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('\nHave you saved the credentials file? (yes/no): ', (answer) => {
                rl.close();

                if (answer.toLowerCase() === 'yes') {
                    if (fs.existsSync(this.CREDENTIALS_PATH)) {
                        console.log('\n✅ Credentials file found! You can now run authentication.');
                        resolve(true);
                    } else {
                        console.log(`\n❌ No credentials file found at ${this.CREDENTIALS_PATH}`);
                        resolve(false);
                    }
                } else {
                    console.log('\nPlease complete the steps and try again.');
                    resolve(false);
                }
            });
        });
    }

    async authenticate(): Promise<boolean> {
        if (!fs.existsSync(this.CREDENTIALS_PATH)) {
            console.log(`\n❌ Credentials file not found at ${this.CREDENTIALS_PATH}`);
            console.log('Please run setup first.');
            return false;
        }

        console.log('\nStarting Google Calendar authentication flow...');

        try {
            await this.getAccessToken(null);
            console.log('\n✅ Successfully authenticated with Google Calendar!');
            return true;
        } catch (error) {
            console.error('Authentication error:', error);
            return false;
        }
    }

    /**
     * Create an OAuth2 client using credentials and token.json
     */
    private async authorize() {
        try {
            const content = await fs.promises.readFile(this.CREDENTIALS_PATH);
            const credentials = JSON.parse(content as unknown as string);
            const { client_secret, client_id, redirect_uris } = credentials.installed;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

            try {
                const token = await fs.promises.readFile(this.TOKEN_PATH);
                oAuth2Client.setCredentials(JSON.parse(token as unknown as string));
                return oAuth2Client;
            } catch (err) {
                return this.getAccessToken(oAuth2Client);
            }
        } catch (err) {
            console.error('Error loading client secret file:', err);
            throw err;
        }
    }

    /**
     * Get and store new token after prompting for user authorization
     */
    private async getAccessToken(oAuth2Client) {
        if (!oAuth2Client) {
            const content = await fs.promises.readFile(this.CREDENTIALS_PATH);
            const credentials = JSON.parse(content as unknown as string);
            const { client_secret, client_id, redirect_uris } = credentials.installed;
            oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        }

        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.SCOPES,
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
                    fs.writeFile(this.TOKEN_PATH, JSON.stringify(token), (err) => {
                        if (err) console.error(err);
                        console.log('Token stored to', this.TOKEN_PATH);
                    });
                    resolve(oAuth2Client);
                });
            });
        });
    }

    /**
     * Parse calendar event details from XML content
     */
    private parseCalendarEvent(calendarXml: string) {
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
    private async addCalendarEvent(auth, eventDetails) {
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

    async run(messageContent: string): Promise<ToolResult> {
        const calendarContent = extractXmlContent(messageContent, 'calendar');
        if (calendarContent) {
            console.log('Calendar event detected:', calendarContent);

            const eventDetails = this.parseCalendarEvent(calendarContent);
            console.log('Parsed event details:', eventDetails);

            try {
                const auth = await this.authorize();
                const result = await this.addCalendarEvent(auth, eventDetails);

                return {
                    message: `Calendar event "${eventDetails.summary}" was successfully created in your primary calendar.`,
                    success: true
                };
            } catch (error: any) {
                return {
                    message: `Failed to create calendar event: ${error.message}`,
                    success: false
                };
            }
        }

        return {
            message: "No calendar event data found in the message",
            success: false
        };
    }
}

// Export a singleton instance
export const calendarTool = new CalendarTool();
registerTool(calendarTool);
