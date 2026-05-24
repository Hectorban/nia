import { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, type PartialOptions, type VoiceConversation } from '@elevenlabs/client';
import { getDeviceSettings, saveDeviceSettings, getRealtimeSettings } from '../db';
import { saveSession } from '../db/sessions';
import { VTubeStudioService, findBestExpressionMatch } from '../services/vtubeStudio';
import { FirecrawlService } from '../services/firecrawl';

export const useRealtimeChat = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [conversationLog, setConversationLog] = useState<{ speaker: 'You' | 'Agent'; text: string }[]>([]);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAgentTranscript, setLiveAgentTranscript] = useState('');
  const [lastUserTranscript, setLastUserTranscript] = useState('');
  const [lastAgentTranscript, setLastAgentTranscript] = useState('');
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
  const [inputVolume, setInputVolume] = useState<number>(0);
  const [outputVolume, setOutputVolume] = useState<number>(0);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [vtubeStudioConnected, setVtubeStudioConnected] = useState(false);

  const conversationRef = useRef<VoiceConversation | null>(null);
  const volumePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vtubeStudioService = useRef<VTubeStudioService | null>(null);

  // Start polling volume levels from the SDK's built-in analysers.
  // This replaces the old MediaRecorder-based visualizer, avoiding the
  // dual-mic-stream conflict (Nia's getUserMedia vs LiveKit's mic capture).
  const startVolumePolling = useCallback(() => {
    if (volumePollRef.current) return;
    volumePollRef.current = setInterval(() => {
      if (conversationRef.current) {
        try {
          setInputVolume(conversationRef.current.getInputVolume());
          setOutputVolume(conversationRef.current.getOutputVolume());
        } catch {
          // ignore transient errors during device switches
        }
      }
    }, 80); // ~12fps — smooth enough for a volume bar, cheap on CPU
  }, []);

  const stopVolumePolling = useCallback(() => {
    if (volumePollRef.current) {
      clearInterval(volumePollRef.current);
      volumePollRef.current = null;
    }
    setInputVolume(0);
    setOutputVolume(0);
  }, []);

  const handleDisconnect = useCallback(async () => {
    console.log('Disconnecting...');

    const convId = conversationRef.current?.getId();
    const convStartTime = sessionStartTime;

    // End the ElevenLabs conversation session
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }

    // Stop volume polling
    stopVolumePolling();

    // Save session data before fully disconnecting
    if (convStartTime && conversationLog.length > 0 && convId) {
      try {
        const endTime = Date.now();
        const durationSeconds = Math.floor((endTime - convStartTime) / 1000);

        // Get device names
        const micDevice = audioInputDevices.find(d => d.deviceId === selectedMicId)?.label || 'Default Microphone';
        const speakerDevice = audioOutputDevices.find(d => d.deviceId === selectedSpeakerId)?.label || 'Default Speaker';

        // Get agent ID from settings
        const settings = await getRealtimeSettings();
        const agentId = settings?.elevenlabsAgentId || 'unknown';

        // Prepare messages with timestamps
        const messages = conversationLog.map((msg, index) => ({
          speaker: msg.speaker,
          text: msg.text,
          timestamp: convStartTime + (index * 1000),
        }));

        // Save session to database
        await saveSession(
          {
            start_time: convStartTime,
            end_time: endTime,
            duration_seconds: durationSeconds,
            agent_id: agentId,
            conversation_id: convId,
            mic_device: micDevice,
            speaker_device: speakerDevice,
          },
          messages
        );

        console.log('Session saved successfully');
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }

    setIsConnected(false);
    setLiveUserTranscript('');
    setLiveAgentTranscript('');
    setSessionStartTime(null);
    console.log('Disconnected');
  }, [sessionStartTime, conversationLog, audioInputDevices, audioOutputDevices, selectedMicId, selectedSpeakerId, stopVolumePolling]);

  const getAudioDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
    } catch (error) {
      console.error('Error getting audio devices:', error);
    }
  }, []);

  useEffect(() => {
    getAudioDevices();
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
      if (conversationRef.current) {
        handleDisconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAudioDevices]);

  useEffect(() => {
    const loadSettings = async () => {
      const deviceSettings = await getDeviceSettings();
      if (deviceSettings.selectedMicId) {
        setSelectedMicId(deviceSettings.selectedMicId);
      } else {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        if (audioInputs.length > 0) setSelectedMicId(audioInputs[0].deviceId);
      }
      if (deviceSettings.selectedSpeakerId) {
        setSelectedSpeakerId(deviceSettings.selectedSpeakerId);
      } else {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
        if (audioOutputs.length > 0) setSelectedSpeakerId(audioOutputs[0].deviceId);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const save = async () => {
      await saveDeviceSettings({ selectedMicId, selectedSpeakerId });
    };
    if (selectedMicId || selectedSpeakerId) {
      save();
    }
  }, [selectedMicId, selectedSpeakerId]);

  // Initialize VTube Studio service
  useEffect(() => {
    if (!vtubeStudioService.current) {
      vtubeStudioService.current = VTubeStudioService.getInstance();
      vtubeStudioService.current.connect()
        .then(() => {
          console.log('Connected to VTube Studio');
          setVtubeStudioConnected(true);
        })
        .catch((error) => {
          console.log('VTube Studio not available:', error.message);
          setVtubeStudioConnected(false);
        });
    }
  }, []);

  // Client tools for ElevenLabs Agents
  const clientTools: Record<string, (parameters: any) => Promise<string | number | void> | string | number | void> = {
    // VTube Studio expression changes
    change_expression: async (params: { expression: string; duration?: number }) => {
      if (!vtubeStudioService.current || !vtubeStudioConnected) {
        return 'VTube Studio not connected';
      }
      try {
        await vtubeStudioService.current.activateExpression(params.expression, params.duration);
        return `Successfully activated expression: ${params.expression}`;
      } catch (error) {
        console.error('Failed to activate expression:', error);
        return `Failed to activate expression: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },

    // Emotion-based expression triggering
    trigger_emotion: async (params: { emotion: string; duration?: number }) => {
      if (!vtubeStudioService.current || !vtubeStudioConnected) {
        return 'VTube Studio not connected';
      }
      try {
        const expressions = await vtubeStudioService.current.getExpressions();
        const bestMatch = findBestExpressionMatch(params.emotion, expressions);
        if (!bestMatch) {
          return `No suitable expression found for emotion: ${params.emotion}`;
        }
        await vtubeStudioService.current.activateExpression(bestMatch, params.duration || 3);
        return `Triggered ${params.emotion} emotion with expression: ${bestMatch}`;
      } catch (error) {
        console.error('Failed to trigger emotion:', error);
        return `Failed to trigger emotion: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },

    // Firecrawl URL fetching
    fetch_url: async (params: { url: string; includeScreenshot?: boolean }) => {
      try {
        const settings = await getRealtimeSettings();
        const firecrawlApiKey = settings?.firecrawlApiKey;
        if (!firecrawlApiKey) {
          return 'Error: Firecrawl API key is not configured. Please set it in the configuration.';
        }

        console.log('Fetching URL content:', params.url, params.includeScreenshot ? '(with screenshot)' : '');
        const response = await FirecrawlService.scrapeWithApiKey(params.url, firecrawlApiKey, params.includeScreenshot);

        if (!response.success) {
          return `Error fetching URL: ${response.error}`;
        }
        if (!response.markdown) {
          return 'Error: No content retrieved from URL';
        }

        const { markdown, metadata, screenshot, actions } = response;
        const title = metadata?.title || 'Unknown Title';
        const description = metadata?.description || '';
        const screenshotUrl = screenshot || actions?.screenshots?.[0];

        let result = `Successfully fetched content from: ${params.url}\n\nTitle: ${title}${description ? `\nDescription: ${description}` : ''}`;
        if (screenshotUrl) {
          result += `\nScreenshot: ${screenshotUrl}`;
        }
        result += `\n\nContent:\n${markdown}`;
        return result;
      } catch (error) {
        return `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },

    // Firecrawl URL screenshot
    screenshot_url: async (params: { url: string }) => {
      try {
        const settings = await getRealtimeSettings();
        const firecrawlApiKey = settings?.firecrawlApiKey;
        if (!firecrawlApiKey) {
          return 'Error: Firecrawl API key is not configured.';
        }

        const response = await FirecrawlService.scrapeWithApiKey(params.url, firecrawlApiKey, true);
        if (!response.success) {
          return `Error taking screenshot: ${response.error}`;
        }

        const screenshotUrl = response.screenshot || response.actions?.screenshots?.[0];
        if (!screenshotUrl) {
          return 'Error: No screenshot was captured from the URL';
        }

        const title = response.metadata?.title || 'Unknown Title';
        return `Successfully captured screenshot of: ${params.url}\n\nTitle: ${title}\nScreenshot: ${screenshotUrl}`;
      } catch (error) {
        return `Failed to take screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  };

  const handleConnect = async () => {
    console.log('=== handleConnect START ===');
    try {
      if (!selectedMicId) {
        console.log('No microphone selected, returning');
        return;
      }

      console.log('Getting ElevenLabs settings...');
      const settings = await getRealtimeSettings();
      const apiKey = settings?.elevenlabsApiKey;
      const agentId = settings?.elevenlabsAgentId;

      if (!apiKey) throw new Error('ElevenLabs API key is not configured. Please set it in the settings.');
      if (!agentId) throw new Error('ElevenLabs Agent ID is not configured. Please set it in the settings.');

      // NOTE: We deliberately do NOT call getUserMedia here anymore.
      // The ElevenLabs SDK's webSessionSetup() handles microphone permission
      // and device selection internally via LiveKit's setMicrophoneEnabled().
      // Getting a separate MediaStream here would lock the mic and prevent
      // LiveKit from capturing audio for the agent.

      console.log('Starting ElevenLabs conversation session...');

      // Build overrides
      const promptOverride = settings?.prompt
        ? { prompt: settings.prompt }
        : undefined;

      const selectedLanguage = (settings?.language || 'es') as any;

      const options: PartialOptions = {
        agentId,
        authorization: apiKey,
        connectionType: 'webrtc',
        clientTools,
        overrides: {
          agent: {
            prompt: promptOverride,
            language: (selectedLanguage as any),
          },
        },
        onConnect: ({ conversationId }) => {
          console.log('Connected to ElevenLabs agent, conversation ID:', conversationId);
          setIsConnected(true);
          setSessionStartTime(Date.now());
          // Start polling volume levels from the SDK's built-in analysers
          startVolumePolling();
        },
        onDisconnect: (details) => {
          console.log('Disconnected from ElevenLabs agent:', details);
          setIsConnected(false);
          stopVolumePolling();
        },
        onError: (message, context) => {
          console.error('ElevenLabs conversation error:', message, context);
        },
        onMessage: (props) => {
          const { message, source: role } = props;
          const speaker = role === 'user' ? 'You' : 'Agent';
          setConversationLog(prev => [...prev, { speaker, text: message }]);
          if (role === 'user') {
            setLastUserTranscript(message);
            setTimeout(() => setLiveUserTranscript(''), 500);
          } else {
            setLastAgentTranscript(message);
            setTimeout(() => setLiveAgentTranscript(''), 500);
          }
        },
        onModeChange: ({ mode }) => {
          if (mode === 'speaking') {
            setLiveAgentTranscript('');
          } else {
            setLiveUserTranscript('');
          }
        },
        onStatusChange: ({ status }) => {
          console.log('ElevenLabs status:', status);
        },
      };

      const conversation = await Conversation.startSession(options);
      conversationRef.current = conversation as VoiceConversation;

      console.log('=== handleConnect END ===');
    } catch (error) {
      console.error('=== handleConnect ERROR ===');
      console.error('Error connecting:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
      }
      handleDisconnect();
    }
  };

  // Runtime microphone switching via the SDK's changeInputDevice
  const handleMicChange = useCallback((micId: string) => {
    setSelectedMicId(micId);
    if (conversationRef.current) {
      conversationRef.current.changeInputDevice({ inputDeviceId: micId }).catch((error) => {
        console.error('Failed to switch input device:', error);
      });
    }
  }, []);

  // Runtime speaker switching via the SDK's changeOutputDevice
  const handleSpeakerChange = useCallback((speakerId: string) => {
    setSelectedSpeakerId(speakerId);
    if (conversationRef.current) {
      conversationRef.current.changeOutputDevice({ outputDeviceId: speakerId }).catch((error) => {
        console.error('Failed to switch output device:', error);
      });
    }
  }, []);

  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    const vol = newValue as number;
    setVolume(vol);
    if (conversationRef.current) {
      conversationRef.current.setVolume({ volume: vol / 100 });
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (conversationRef.current) {
      conversationRef.current.setMicMuted(newMuted);
    }
  };

  // Send text message to the active conversation.
  // Uses conversationRef (not isConnected state) as the primary guard to avoid
  // race conditions where the ref is set but React hasn't re-rendered yet.
  const sendTextMessage = useCallback((message: string) => {
    if (!conversationRef.current) {
      console.warn('Cannot send message: no active conversation');
      return;
    }
    if (!message.trim()) {
      console.warn('Cannot send message: empty message');
      return;
    }

    console.log('Sending text message:', message);
    setConversationLog(prev => [...prev, { speaker: 'You', text: message }]);

    // sendUserMessage is not awaited by the SDK, but the underlying
    // WebRTC connection's sendMessage is async. Fire-and-forget is fine —
    // the data channel handles delivery; errors surface via onError.
    conversationRef.current.sendUserMessage(message);
  }, []);

  return {
    isConnected,
    conversationLog,
    liveUserTranscript,
    liveAgentTranscript,
    lastUserTranscript,
    lastAgentTranscript,
    audioInputDevices,
    audioOutputDevices,
    selectedMicId,
    selectedSpeakerId,
    inputVolume,
    outputVolume,
    volume,
    isMuted,
    sessionStartTime,
    handleMicChange,
    handleSpeakerChange,
    handleVolumeChange,
    toggleMute,
    handleConnect,
    handleDisconnect,
    sendTextMessage,
  };
};
