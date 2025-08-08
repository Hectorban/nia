import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category: string;
  labels: { [key: string]: string };
}

export interface StreamingOptions {
  model?: string;
  language?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  output_format?: string;
}

export interface ElevenLabsStreamingConnection {
  websocket: WebSocket | null;
  audioElement: HTMLAudioElement | null;
  audioContext: AudioContext | null;
  sourceNode: AudioBufferSourceNode | null;
  isConnected: boolean;
  onAudioChunk?: (chunk: ArrayBuffer) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class ElevenLabsService {
  private client: ElevenLabsClient | null = null;
  private apiKey: string | null = null;
  private streamingConnection: ElevenLabsStreamingConnection | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new ElevenLabsClient({ apiKey });
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.client);
  }

  async getVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.client) {
      throw new Error('ElevenLabs API not configured');
    }

    try {
      const response = await this.client.voices.getAll();
      console.log('ElevenLabs API response:', response);
      console.log('First voice object:', response.voices?.[0]);
      
      return response.voices.map((voice: any) => {
        console.log('Mapping voice:', voice);
        return {
          voice_id: voice.voice_id || voice.voiceId || voice.id,
          name: voice.name,
          preview_url: voice.preview_url || voice.previewUrl,
          category: voice.category,
          labels: voice.labels || {}
        };
      });
    } catch (error) {
      console.error('Failed to get ElevenLabs voices:', error);
      throw error;
    }
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.voices.getAll();
      return true;
    } catch (error) {
      console.error('ElevenLabs API key validation failed:', error);
      return false;
    }
  }

  async generateSpeech(text: string, voiceId: string, options?: {
    model?: string;
    language?: string;
    voice_settings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    };
  }): Promise<ArrayBuffer> {
    if (!this.client) {
      throw new Error('ElevenLabs API not configured');
    }

    try {
      const audioStream = await this.client.textToSpeech.convert(voiceId, {
        text: text,
        modelId: options?.model || 'eleven_multilingual_v2',
        voiceSettings: options?.voice_settings || {
          stability: 0.5,
          similarityBoost: 0.8,
          style: 0.0,
          useSpeakerBoost: true
        }
      });

      // Convert stream to ArrayBuffer
      const reader = audioStream.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          chunks.push(value);
        }
      }
      
      // Combine chunks into single ArrayBuffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result.buffer;
    } catch (error) {
      console.error('Failed to generate ElevenLabs speech:', error);
      throw error;
    }
  }

  async playText(text: string, voiceId: string, audioElement?: HTMLAudioElement, options?: {
    model?: string;
    language?: string;
    voice_settings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    };
  }): Promise<HTMLAudioElement> {
    try {
      const audioBuffer = await this.generateSpeech(text, voiceId, options);
      return this.playAudio(audioBuffer, audioElement);
    } catch (error) {
      console.error('Failed to play ElevenLabs text:', error);
      throw error;
    }
  }

  playAudio(audioBuffer: ArrayBuffer, audioElement?: HTMLAudioElement): HTMLAudioElement {
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audio = audioElement || new Audio();
    audio.src = audioUrl;
    audio.play().catch(error => {
      console.error('Failed to play ElevenLabs audio:', error);
    });

    // Clean up URL after playing
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
    });

    return audio;
  }

  // Helper method to convert audio chunks to playable format
  static createAudioFromChunks(chunks: Uint8Array[]): Blob {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedChunks = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combinedChunks.set(chunk, offset);
      offset += chunk.length;
    }
    
    return new Blob([combinedChunks], { type: 'audio/mpeg' });
  }

  // Helper method to play audio immediately from chunks
  static playAudioChunks(chunks: Uint8Array[], audioElement?: HTMLAudioElement): HTMLAudioElement {
    const audioBlob = this.createAudioFromChunks(chunks);
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audio = audioElement || new Audio();
    audio.src = audioUrl;
    audio.play().catch(error => {
      console.error('Failed to play ElevenLabs audio:', error);
    });

    // Clean up URL after playing
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
    });

    return audio;
  }

  // WebSocket streaming TTS methods
  async createStreamingConnection(
    voiceId: string,
    options?: StreamingOptions,
    audioElement?: HTMLAudioElement
  ): Promise<ElevenLabsStreamingConnection> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API not configured');
    }

    const connection: ElevenLabsStreamingConnection = {
      websocket: null,
      audioElement: audioElement || null,
      audioContext: null,
      sourceNode: null,
      isConnected: false
    };

    try {
      // Create WebSocket connection
      const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${options?.model || 'eleven_multilingual_v2'}&output_format=${options?.output_format || 'mp3_44100_128'}`;
      
      const websocket = new WebSocket(wsUrl);
      connection.websocket = websocket;

      // Set up WebSocket event handlers
      websocket.onopen = () => {
        console.log('ElevenLabs streaming connection opened');
        connection.isConnected = true;
        
        // Send initial configuration
        const config = {
          text: ' ', // Initial space to start the stream
          voice_settings: options?.voice_settings || {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true
          },
          xi_api_key: this.apiKey
        };
        
        websocket.send(JSON.stringify(config));
      };

      websocket.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // Audio data received
          const arrayBuffer = await event.data.arrayBuffer();
          this.handleAudioChunk(arrayBuffer, connection);
        } else {
          // JSON message received
          try {
            const message = JSON.parse(event.data);
            console.log('ElevenLabs streaming message:', message);
          } catch (error) {
            console.error('Failed to parse streaming message:', error);
          }
        }
      };

      websocket.onerror = (error) => {
        console.error('ElevenLabs streaming error:', error);
        connection.onError?.(new Error('WebSocket connection error'));
      };

      websocket.onclose = () => {
        console.log('ElevenLabs streaming connection closed');
        connection.isConnected = false;
        connection.onClose?.();
      };

      this.streamingConnection = connection;
      return connection;
    } catch (error) {
      console.error('Failed to create streaming connection:', error);
      throw error;
    }
  }

  private handleAudioChunk(arrayBuffer: ArrayBuffer, connection: ElevenLabsStreamingConnection) {
    try {
      // Call custom audio chunk handler if provided
      connection.onAudioChunk?.(arrayBuffer);
      
      // Play audio chunk immediately if audio element is provided
      if (connection.audioElement) {
        const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create a new audio element for this chunk to allow overlapping playback
        const chunkAudio = new Audio();
        chunkAudio.src = audioUrl;
        chunkAudio.volume = connection.audioElement.volume;
        
        chunkAudio.play().catch(error => {
          console.error('Failed to play audio chunk:', error);
        });
        
        // Clean up URL after playing
        chunkAudio.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl);
        });
      }
    } catch (error) {
      console.error('Failed to handle audio chunk:', error);
    }
  }

  sendTextToStream(text: string): boolean {
    if (!this.streamingConnection?.websocket || !this.streamingConnection.isConnected) {
      console.warn('No active streaming connection');
      return false;
    }

    try {
      const message = {
        text: text,
        try_trigger_generation: true
      };
      
      this.streamingConnection.websocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send text to stream:', error);
      return false;
    }
  }

  flushStream(): boolean {
    if (!this.streamingConnection?.websocket || !this.streamingConnection.isConnected) {
      console.warn('No active streaming connection');
      return false;
    }

    try {
      const message = {
        text: ''
      };
      
      this.streamingConnection.websocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to flush stream:', error);
      return false;
    }
  }

  closeStreamingConnection(): void {
    if (this.streamingConnection?.websocket) {
      this.streamingConnection.websocket.close();
      this.streamingConnection = null;
    }
  }

  isStreamingActive(): boolean {
    return this.streamingConnection?.isConnected || false;
  }
}

// Default Spanish voices (these are popular ElevenLabs voices for Spanish)
export const ELEVENLABS_SPANISH_VOICES = [
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Spanish)' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Spanish)' },
  { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Spanish)' },
];
