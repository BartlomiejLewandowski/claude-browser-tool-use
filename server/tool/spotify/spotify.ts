import { Tool, ToolResult, ToolSetupState, ToolSetupStatus } from '../tool';
import { extractXmlContent } from '../utils';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
    getValidToken,
    searchTrack,
    getPlaybackDevice,
    playTrack,
    readCredentials,
    getAuthToken,
    SpotifyCredentials
} from './api';
import { registerTool } from "../registry";

/**
 * Parse Spotify play command
 */
function parsePlayCommand(spotifyXml: string): { query: string } {
    const trackQuery = extractXmlContent(spotifyXml, 'track') || '';

    if (!trackQuery.trim()) {
        throw new Error('No track specified in Spotify play command');
    }

    return {
        query: trackQuery.trim()
    };
}

export class SpotifyTool implements Tool {
    private CREDENTIALS_PATH = path.join(__dirname, 'spotify_credentials.json');
    private TOKEN_PATH = path.join(__dirname, 'spotify_token.json');

    getTagName(): string {
        return 'spotify';
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
                additionalInfo: 'Missing Spotify API credentials'
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
        console.log('\nSetting up Spotify API credentials');
        console.log('=================================');
        console.log('\n1. Go to Spotify Developer Dashboard: https://developer.spotify.com/dashboard/');
        console.log('2. Create a new app or select an existing one');
        console.log('3. Get your Client ID and Client Secret');
        console.log('4. Add a Redirect URI (e.g., http://localhost:8888/callback)');
        console.log('5. Create a JSON file with the following format:');
        console.log(`
{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "redirect_uri": "YOUR_REDIRECT_URI"
}
        `);
        console.log(`6. Save this file to: ${this.CREDENTIALS_PATH}`);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('\nWould you like to enter your credentials now? (yes/no): ', (answer) => {
                if (answer.toLowerCase() === 'yes') {
                    rl.question('Enter your Spotify Client ID: ', (clientId) => {
                        rl.question('Enter your Spotify Client Secret: ', (clientSecret) => {
                            rl.question('Enter your Redirect URI (default: http://localhost:8888/callback): ', (redirectUri) => {
                                rl.close();

                                const credentials: SpotifyCredentials = {
                                    client_id: clientId,
                                    client_secret: clientSecret,
                                    redirect_uri: redirectUri || 'http://localhost:8888/callback'
                                };

                                try {
                                    // Ensure directory exists
                                    const dir = path.dirname(this.CREDENTIALS_PATH);
                                    if (!fs.existsSync(dir)) {
                                        fs.mkdirSync(dir, { recursive: true });
                                    }

                                    fs.writeFileSync(
                                        this.CREDENTIALS_PATH,
                                        JSON.stringify(credentials, null, 2)
                                    );

                                    console.log(`\n✅ Credentials saved to ${this.CREDENTIALS_PATH}`);
                                    resolve(true);
                                } catch (error: any) {
                                    console.error(`\n❌ Error saving credentials: ${error.message}`);
                                    resolve(false);
                                }
                            });
                        });
                    });
                } else {
                    rl.close();
                    console.log(`\nPlease create the credentials file at ${this.CREDENTIALS_PATH} manually.`);

                    if (fs.existsSync(this.CREDENTIALS_PATH)) {
                        console.log('\n✅ Credentials file already exists! You can now run authentication.');
                        resolve(true);
                    } else {
                        resolve(false);
                    }
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

        console.log('\nStarting Spotify authentication flow...');

        try {
            const credentials = await readCredentials();
            await getAuthToken(credentials);
            return true;
        } catch (error) {
            console.error('Authentication error:', error);
            return false;
        }
    }

    async run(messageContent: string): Promise<ToolResult> {
        // Check for spotify tag
        const spotifyContent = extractXmlContent(messageContent, 'spotify');

        if (!spotifyContent) {
            return {
                message: 'No Spotify command found',
                success: false
            };
        }

        // Check for play command
        const playCommand = extractXmlContent(spotifyContent, 'play');

        if (playCommand) {
            try {
                // Parse play command
                const { query } = parsePlayCommand(playCommand);

                // Get valid token
                const token = await getValidToken();

                // Search for track
                const track = await searchTrack(token, query);

                // Get a device for playback
                const device = await getPlaybackDevice(token);

                // Play the track
                await playTrack(token, device.id, track.uri);

                return {
                    message: `Now playing "${track.name}" by ${track.artists.map(a => a.name).join(', ')} on ${device.name}`,
                    success: true
                };
            } catch (error: any) {
                return {
                    message: `Error playing track: ${error.message}`,
                    success: false
                };
            }
        }

        // No recognized command
        return {
            message: 'Unrecognized Spotify command. Currently supported commands: play',
            success: false
        };
    }
}

// Export a singleton instance
export const spotifyTool = new SpotifyTool();
registerTool(spotifyTool);
