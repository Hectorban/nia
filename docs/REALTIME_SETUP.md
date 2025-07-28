# Setup Guide: OpenAI Realtime API with Tauri and React

This guide provides step-by-step instructions to integrate the OpenAI Realtime API into your Tauri/React application. We will be using the WebRTC connection method, which is ideal for client-side applications.

## Prerequisites

-   Node.js and npm/yarn installed.
-   Rust and Cargo installed (for Tauri).
-   An active OpenAI API key.

## Step 1: Install OpenAI Realtime SDK

The official documentation points to a beta version of the Realtime client library on GitHub. Let's install it.

```bash
npm i openai/openai-realtime-api-beta --save
```

## Step 2: Configure Environment Variables

To keep your API key secure and out of your source code, we'll use an environment file.

1.  Create a file named `.env` in the root of your project (`c:/Users/esteb/Desktop/nia/.env`).

2.  Add your OpenAI API key to the `.env` file. Remember to prefix it with `VITE_` for it to be exposed to your Vite-based React app.

    ```env:c%3A%2FUsers%2Festeb%2FDesktop%2Fnia%2F.env
    VITE_OPENAI_API_KEY="your-openai-api-key-here"
    ```

3.  Add `.env` to your `.gitignore` file to prevent committing your secret key.

    ```gitignore:c%3A%2FUsers%2Festeb%2FDesktop%2Fnia%2F.gitignore
    # ... existing code ...
    .env
    ```

## Step 3: Configure Tauri Permissions

We need to allowlist the OpenAI API endpoint so that our Tauri application can communicate with it.

Open `src-tauri/tauri.conf.json` and add the following to the `allowlist` under `http`.

```json:c%3A%2FUsers%2Festeb%2FDesktop%2Fnia%2Fsrc-tauri%2Ftauri.conf.json
{
  // ... existing config ...
  "tauri": {
    "allowlist": {
      "all": false,
      "http": {
        "all": false,
        "request": true,
        "scope": ["https://api.openai.com/v1/realtime*"]
      }
      // ... other allowlist settings
    },
    // ... rest of config
  }
}
```

## Step 4: Create the Realtime Chat Component

Let's create a new component to handle the Realtime API interaction.

Create a new file at `src/RealtimeChat.tsx`.

```tsx:c%3A%2FUsers%2Festeb%2FDesktop%2Fnia%2Fsrc%2FRealtimeChat.tsx
import { RealtimeClient } from '@openai/realtime-api-beta';
import { useState, useEffect, useRef } from 'react';

const RealtimeChat = () => {
  const [client, setClient] = useState<RealtimeClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [agentTranscript, setAgentTranscript] = useState('');

  const audioEl = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('VITE_OPENAI_API_KEY is not set.');
      return;
    }

    const realtimeClient = new RealtimeClient({
      apiKey: apiKey,
      dangerouslyAllowAPIKeyInBrowser: true,
    });

    realtimeClient.on('connect', () => {
      console.log('Connection established!');
      setIsConnected(true);
    });

    realtimeClient.on('disconnect', () => {
        console.log('Connection closed!');
        setIsConnected(false);
    });

    realtimeClient.on('error', (error) => {
      console.error('RealtimeClient error:', error);
    });

    realtimeClient.on('conversation.updated', ({ item, delta }) => {
      if (item.role === 'user') {
        if (delta?.transcript) {
          setTranscript(prev => prev + delta.transcript);
        }
      } else if (item.role === 'assistant') {
        if (delta?.transcript) {
          setAgentTranscript(prev => prev + delta.transcript);
        }
      }
    });

    realtimeClient.on('conversation.item.completed', ({ item }) => {
        if (item.role === 'user') {
            // When user finishes speaking, clear transcript for next turn.
            setTranscript('');
        } else if (item.role === 'assistant') {
            // When agent finishes speaking, clear transcript for next turn.
            setAgentTranscript('');
        }
    });

    setClient(realtimeClient);

    return () => {
      realtimeClient.disconnect();
    };
  }, []);

  const handleConnect = async () => {
    if (!client) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await client.connect({ stream });

      // Setup audio playback
      if (audioEl.current) {
        audioEl.current.srcObject = client.realtime.remoteStream;
        audioEl.current.play();
      }

    } catch (error) {
      console.error('Error connecting or getting media:', error);
    }
  };

  const handleDisconnect = () => {
    client?.disconnect();
  };

  return (
    <div>
      <h2>Realtime Chat</h2>
      <audio ref={audioEl} autoPlay />
      <div>
        {!isConnected ? (
          <button onClick={handleConnect}>Connect and Talk</button>
        ) : (
          <button onClick={handleDisconnect}>Disconnect</button>
        )}
      </div>
      <div>
        <p><strong>You:</strong> {transcript}</p>
        <p><strong>Agent:</strong> {agentTranscript}</p>
      </div>
    </div>
  );
};

export default RealtimeChat;
```

## Step 5: Integrate into `App.tsx`

Now, let's add our `RealtimeChat` component to the main application view.

```tsx:c%3A%2FUsers%2Festeb%2FDesktop%2Fnia%2Fsrc%2FApp.tsx
// ... existing code ...
import RealtimeChat from './RealtimeChat';

function App() {
  // ... existing code ...

  return (
    <div className="container">
      <h1>Welcome to Tauri!</h1>

      {/* ... existing code ... */}

      <RealtimeChat />
    </div>
  );
}

export default App;
```

## Next Steps

With this setup, you should have a basic but functional voice chat application. You can now run your Tauri app:

```bash
npm run tauri dev
```

Click the "Connect and Talk" button, grant microphone permissions, and start speaking. You should see your speech transcribed in real-time, and the assistant should respond with voice and text.

From here, you can expand on the UI, add more features from the Realtime API like function calling, or customize the assistant's behavior.