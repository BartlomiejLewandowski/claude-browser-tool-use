import { SpotifyTool } from './spotify';

async function main() {
    try {
        console.log('Testing Spotify Tool integration...');

        const spotifyTool = new SpotifyTool();

        // Sample message content with spotify play command
        const messageWithPlay = `
      I'll play that song for you!
      
      <spotify>
        <play>
          <track>The Beatles Here Comes The Sun</track>
        </play>
      </spotify>
      
      Let me know if you'd like to hear something else.
    `;

        console.log('Processing message with play command...');

        const result = await spotifyTool.run(messageWithPlay);

        console.log('Result:', result);

        if (result.success) {
            console.log('Command executed successfully!');
        } else {
            console.log('Command failed to execute.');
        }

    } catch (error) {
        console.error('Error in test:', error);
    }
}

// Run the test
main().catch(console.error);
