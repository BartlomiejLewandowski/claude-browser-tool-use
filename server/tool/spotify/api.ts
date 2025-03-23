import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import axios from 'axios';

// Configuration
const SPOTIFY_CREDENTIALS_PATH = path.join(__dirname, 'spotify_credentials.json');
const SPOTIFY_TOKEN_PATH = path.join(__dirname, 'spotify_token.json');

// Spotify API endpoints
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

// Spotify API scopes needed
const SCOPES = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private'
];

// Token interface
export interface SpotifyToken {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    expires_at?: number;
}

// Credentials interface
export interface SpotifyCredentials {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
}

// Device interface
export interface SpotifyDevice {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number;
}

// Track interface
export interface SpotifyTrack {
    id: string;
    name: string;
    uri: string;
    artists: Array<{ id: string; name: string; uri: string }>;
    album: {
        id: string;
        name: string;
        uri: string;
        images: Array<{ url: string; height: number; width: number }>;
    };
    duration_ms: number;
}

/**
 * Read credentials from file
 */
export async function readCredentials(): Promise<SpotifyCredentials> {
    try {
        const content = await fs.promises.readFile(SPOTIFY_CREDENTIALS_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        console.error('Error reading Spotify credentials:', err);
        throw new Error(
            'Please create a spotify_credentials.json file with your client_id and client_secret from the Spotify Developer Dashboard'
        );
    }
}

/**
 * Read saved token, if available
 */
export async function readToken(): Promise<SpotifyToken | null> {
    try {
        const content = await fs.promises.readFile(SPOTIFY_TOKEN_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        return null;
    }
}

/**
 * Save token to file
 */
export async function saveToken(token: SpotifyToken): Promise<void> {
    await fs.promises.writeFile(SPOTIFY_TOKEN_PATH, JSON.stringify(token));
    console.log('Token saved to', SPOTIFY_TOKEN_PATH);
}

/**
 * Get new auth token via user authorization
 */
export async function getAuthToken(credentials: SpotifyCredentials): Promise<SpotifyToken> {
    const { client_id, client_secret, redirect_uri } = credentials;

    // Generate authorization URL
    const authUrl = new URL(SPOTIFY_AUTH_URL);
    authUrl.searchParams.append('client_id', client_id);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirect_uri);
    authUrl.searchParams.append('scope', SCOPES.join(' '));

    console.log('Please authorize this app by visiting:');
    console.log(authUrl.toString());

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        rl.question('Enter the authorization code from the callback URL: ', async (code) => {
            rl.close();

            try {
                // Exchange authorization code for access token
                const tokenResponse = await axios.post(
                    SPOTIFY_TOKEN_URL,
                    new URLSearchParams({
                        code,
                        redirect_uri,
                        grant_type: 'authorization_code'
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': 'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64')
                        }
                    }
                );

                const token = {
                    ...tokenResponse.data,
                    expires_at: Date.now() + (tokenResponse.data.expires_in * 1000)
                };

                await saveToken(token);
                resolve(token);
            } catch (err: any) {
                console.error('Error getting access token:', err.response?.data || err.message);
                reject(err);
            }
        });
    });
}

/**
 * Refresh the access token if expired
 */
export async function refreshToken(token: SpotifyToken, credentials: SpotifyCredentials): Promise<SpotifyToken> {
    const { client_id, client_secret } = credentials;

    try {
        const response = await axios.post(
            SPOTIFY_TOKEN_URL,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: token.refresh_token
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64')
                }
            }
        );

        const newToken = {
            ...token,
            access_token: response.data.access_token,
            expires_in: response.data.expires_in,
            expires_at: Date.now() + (response.data.expires_in * 1000)
        };

        if (response.data.refresh_token) {
            newToken.refresh_token = response.data.refresh_token;
        }

        await saveToken(newToken);
        return newToken;
    } catch (err:any) {
        console.error('Error refreshing token:', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Get valid Spotify access token
 */
export async function getValidToken(): Promise<SpotifyToken> {
    const credentials = await readCredentials();
    let token = await readToken();

    if (!token) {
        // No token exists, get a new one
        return getAuthToken(credentials);
    }

    // Check if token is expired and refresh if needed
    if (token.expires_at && token.expires_at < Date.now()) {
        console.log('Token expired, refreshing...');
        return refreshToken(token, credentials);
    }

    return token;
}

/**
 * Get available Spotify devices
 */
export async function getAvailableDevices(token: SpotifyToken): Promise<SpotifyDevice[]> {
    try {
        const response = await axios.get(`${SPOTIFY_API_BASE_URL}/me/player/devices`, {
            headers: {
                'Authorization': `Bearer ${token.access_token}`
            }
        });

        return response.data.devices;
    } catch (err:any) {
        console.error('Error getting devices:', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Search for a track on Spotify
 */
export async function searchTrack(token: SpotifyToken, query: string): Promise<SpotifyTrack> {
    try {
        const response = await axios.get(`${SPOTIFY_API_BASE_URL}/search`, {
            params: {
                q: query,
                type: 'track',
                limit: 1
            },
            headers: {
                'Authorization': `Bearer ${token.access_token}`
            }
        });

        if (response.data.tracks.items.length === 0) {
            throw new Error(`No tracks found for query: ${query}`);
        }

        return response.data.tracks.items[0];
    } catch (err:any) {
        console.error('Error searching for track:', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Play a track on a Spotify device
 */
export async function playTrack(token: SpotifyToken, deviceId: string, trackUri: string): Promise<boolean> {
    try {
        await axios.put(
            `${SPOTIFY_API_BASE_URL}/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`,
            { uris: [trackUri] },
            {
                headers: {
                    'Authorization': `Bearer ${token.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`Playing track: ${trackUri}`);
        return true;
    } catch (err:any) {
        console.error('Error playing track:', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Get a suitable device for playback, prioritizing active devices
 */
export async function getPlaybackDevice(token: SpotifyToken): Promise<SpotifyDevice> {
    const devices = await getAvailableDevices(token);

    if (devices.length === 0) {
        throw new Error('No available Spotify devices found. Please open Spotify on a device.');
    }

    // Return the first active device, or the first device if none are active
    return devices.find(d => d.is_active) || devices[0];
}
