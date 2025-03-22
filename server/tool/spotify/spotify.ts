import { Tool, ToolResult } from '../tool'; // Adjust the import path as needed
import { extractXmlContent } from '../utils'; // Adjust the import path as needed
import {
    getValidToken,
    searchTrack,
    getPlaybackDevice,
    playTrack
} from './api';
import {registerTool} from "../registry";

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
    getTagName(): string {
        return 'spotify';
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

// If we need to register the tool automatically when importing
export const spotifyTool = new SpotifyTool();
registerTool(spotifyTool); // You would need to import registerTool from your registry
