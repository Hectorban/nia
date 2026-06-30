import { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, VoiceConversation, type PartialOptions } from '@elevenlabs/client';
import { getDeviceSettings, saveDeviceSettings, getRealtimeSettings } from '../db';
import { saveSession } from '../db/sessions';
import { VTubeStudioService, findBestExpressionMatch } from '../services/vtubeStudio';
import { FirecrawlService } from '../services/firecrawl';

// Decoupled pipeline imports
import { Pipeline } from '../pipeline/Pipeline';
import { MicSource } from '../pipeline/transport/MicSource';
import { SpeakerSink } from '../pipeline/transport/SpeakerSink';
import { RMSVAD } from '../pipeline/vad/RMSVAD';
import { InterruptionController } from '../pipeline/vad/InterruptionController';
import { ElevenLabsSTT } from '../pipeline/services/stt/ElevenLabsSTT';
import { OpenRouterLLM } from '../pipeline/services/llm/OpenRouterLLM';
import { ElevenLabsTTS } from '../pipeline/services/tts/ElevenLabsTTS';
import { createContextAggregator } from '../pipeline/ContextAggregator';
import { ToolRegistry } from '../pipeline/agent/ToolRegistry';
import { ToolDispatcher } from '../pipeline/agent/ToolDispatcher';
import { AgentContext } from '../pipeline/agent/AgentContext';
import {
  createChangeExpressionTool,
  createTriggerEmotionTool,
  createFetchUrlTool,
  createScreenshotUrlTool,
} from '../pipeline/agent/tools/index';
import { type Frame, FrameDirection, transcription } from '../pipeline/frames';

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
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const conversationRef = useRef<VoiceConversation | null>(null);
  const volumePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vtubeStudioService = useRef<VTubeStudioService | null>(null);

  // Decoupled pipeline refs
  const pipelineRef = useRef<Pipeline | null>(null);
  const micSourceRef = useRef<MicSource | null>(null);
  const speakerSinkRef = useRef<SpeakerSink | null>(null);
  const toolDispatcherRef = useRef<ToolDispatcher | null>(null);
  const agentContextRef = useRef<AgentContext | null>(null);
  const pipelineModeRef = useRef<'managed' | 'decoupled'>('managed');

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

    if (pipelineModeRef.current === 'decoupled') {
      // Decoupled mode cleanup
      const p = pipelineRef.current;
      if (p) {
        await p.stop();
        pipelineRef.current = null;
      }
      micSourceRef.current = null;
      speakerSinkRef.current = null;
      toolDispatcherRef.current = null;
      agentContextRef.current = null;

      // Save session data
      if (sessionStartTime && conversationLog.length > 0) {
        try {
          const endTime = Date.now();
          const durationSeconds = Math.floor((endTime - sessionStartTime) / 1000);
          const micDevice = audioInputDevices.find(d => d.deviceId === selectedMicId)?.label || 'Default Microphone';
          const speakerDevice = audioOutputDevices.find(d => d.deviceId === selectedSpeakerId)?.label || 'Default Speaker';
          const messages = conversationLog.map((msg, index) => ({
            speaker: msg.speaker,
            text: msg.text,
            timestamp: sessionStartTime + (index * 1000),
          }));
          await saveSession(
            {
              start_time: sessionStartTime,
              end_time: endTime,
              duration_seconds: durationSeconds,
              agent_id: 'decoupled',
              conversation_id: `decoupled-${sessionStartTime}`,
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
      console.log('Disconnected (decoupled)');
      return;
    }

    // Managed mode cleanup (existing)
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
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setConnectionError(null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
    } catch (error) {
      console.error('Error getting audio devices:', error);
      // On Linux (X11/i3), the browser may not have mic permission yet
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errMsg.includes('NotAllowedError') || errMsg.includes('not allowed') || errMsg.includes('permission')) {
        setConnectionError('Microphone access denied. Please grant microphone permission in your browser or system settings, then reload.');
      } else {
        setConnectionError(`Could not access microphone: ${errMsg}`);
      }
    } finally {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
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
    setConnectionError(null);
    try {
      if (!selectedMicId) {
        console.log('No microphone selected, returning');
        return;
      }

      console.log('Getting settings...');
      const settings = await getRealtimeSettings();

      // === Decoupled mode ===
      if (settings?.pipelineMode === 'decoupled') {
        const apiKey = settings.elevenlabsApiKey;
        const voiceId = settings.elevenlabsVoiceId;
        const openRouterKey = settings.openRouterApiKey;
        const llmModel = settings.llmModel || 'anthropic/claude-sonnet-4';

        if (!apiKey) throw new Error('ElevenLabs API key is required for decoupled mode');
        if (!openRouterKey) throw new Error('OpenRouter API key is required for decoupled mode');
        if (!voiceId) throw new Error('ElevenLabs voice ID is required for decoupled mode');

        pipelineModeRef.current = 'decoupled';

        // Create tools registry with existing tools
        const toolRegistry = new ToolRegistry();
        const vtubeService = VTubeStudioService.getInstance();
        const vtubeConnected = vtubeStudioConnected;
        toolRegistry.register(createChangeExpressionTool(vtubeService, () => vtubeConnected));
        toolRegistry.register(createTriggerEmotionTool(vtubeService, () => vtubeConnected));
        toolRegistry.register(createFetchUrlTool(() => settings.firecrawlApiKey));
        toolRegistry.register(createScreenshotUrlTool(() => settings.firecrawlApiKey));

        const toolDispatcher = new ToolDispatcher(toolRegistry);
        toolDispatcherRef.current = toolDispatcher;

        const { user: ctxUser, assistant: ctxAssistant, context } = createContextAggregator();

        const agentContext = new AgentContext({
          name: 'Nia',
          systemPrompt: settings.prompt || undefined,
          language: settings.language || 'es',
          model: llmModel,
        });
        agentContextRef.current = agentContext;

        // Build pipeline components
        const micSource = new MicSource({ deviceId: selectedMicId });
        micSourceRef.current = micSource;

        const speakerSink = new SpeakerSink({
          deviceId: selectedSpeakerId || undefined,
          sampleRate: 44100,
        });
        speakerSinkRef.current = speakerSink;

        const rmsVad = new RMSVAD();
        const stt = new ElevenLabsSTT({
          apiKey,
          modelId: settings.elevenlabsSttModel || 'scribe_v2_realtime',
          languageCode: settings.language || 'es',
        });
        const llm = new OpenRouterLLM(
          {
            apiKey: openRouterKey,
            model: llmModel,
            systemPrompt: settings.prompt,
            tools: toolRegistry.toToolDefinitions(),
            onToolCall: async (name, args) => toolDispatcher.executeTool(name, args),
          },
          context,
        );
        const tts = new ElevenLabsTTS({
          apiKey,
          voiceId,
          modelId: settings.elevenlabsTtsModel || 'eleven_flash_v2_5',
        });

        const interruptionController = new InterruptionController({
          onInterrupt: () => { pipeline.interrupt(); },
        });

        // Build the pipeline
        const pipeline = new Pipeline([
          micSource,
          rmsVad,
          stt,
          ctxUser,
          interruptionController,
          llm,
          tts,
          ctxAssistant,
          speakerSink,
        ]);

        // Wire output sink
        pipeline.sink.onFrame = (frame: Frame, direction: FrameDirection) => {
          if (direction !== FrameDirection.Downstream) return;
          switch (frame.kind) {
            case 'transcription': {
              const tf = frame as import('../pipeline/frames').TranscriptionFrame;
              if (tf.isFinal) {
                setConversationLog(prev => [...prev, { speaker: 'You', text: tf.text }]);
                setLastUserTranscript(tf.text);
                setTimeout(() => setLiveUserTranscript(''), 500);
              } else {
                setLiveUserTranscript(tf.text);
              }
              break;
            }
            case 'llm-text': {
              const lf = frame as import('../pipeline/frames').LLMTextFrame;
              setLiveAgentTranscript(prev => prev + lf.text);
              break;
            }
            case 'llm-full-response': {
              const lf = frame as import('../pipeline/frames').LLMFullResponseFrame;
              setConversationLog(prev => [...prev, { speaker: 'Agent', text: lf.text }]);
              setLastAgentTranscript(lf.text);
              break;
            }
            case 'error': {
              const ef = frame as import('../pipeline/frames').ErrorFrame;
              console.error('Pipeline error:', ef.error);
              break;
            }
          }
        };

        pipelineRef.current = pipeline;

        // Start the pipeline
        await pipeline.start();

        // Start volume polling from MicSource
        if (volumePollRef.current) clearInterval(volumePollRef.current);
        volumePollRef.current = setInterval(() => {
          if (micSourceRef.current) {
            setInputVolume(micSourceRef.current.getVolume());
          }
        }, 80);

        setIsConnected(true);
        setSessionStartTime(Date.now());
        console.log('Decoupled pipeline started');
        return;
      }

      // === Managed mode (existing) ===
      console.log('Getting ElevenLabs settings...');
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
        inputDeviceId: selectedMicId || undefined,
        outputDeviceId: selectedSpeakerId || undefined,
        overrides: {
          agent: {
            prompt: promptOverride,
            language: (selectedLanguage as any),
          },
        },
        onConversationCreated: (conversation) => {
          conversationRef.current = conversation as VoiceConversation;
          console.log('Conversation created, type:', (conversation as any).type);
          if (selectedMicId) {
            conversationRef.current.changeInputDevice({ inputDeviceId: selectedMicId }).catch((err) => {
              console.error('Failed to set initial input device:', err);
            });
          }
          if (selectedSpeakerId) {
            conversationRef.current.changeOutputDevice({ outputDeviceId: selectedSpeakerId }).catch((err) => {
              console.error('Failed to set initial output device:', err);
            });
          }
        },
        onConnect: ({ conversationId }) => {
          console.log('Connected to ElevenLabs agent, conversation ID:', conversationId);
          setIsConnected(true);
          setSessionStartTime(Date.now());
          startVolumePolling();
          console.log('onConnect: mic device =', selectedMicId, 'speaker device =', selectedSpeakerId);
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
          console.log('onMessage:', props);
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
          console.log('onModeChange:', mode);
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

      await Conversation.startSession(options);
      // conversationRef is already set by onConversationCreated callback
      console.log('=== handleConnect END ===');
    } catch (error) {
      console.error('=== handleConnect ERROR ===');
      console.error('Error connecting:', error);
      const msg = error instanceof Error ? error.message : 'Unknown connection error';
      // Decoupled mode MicSource.start() or managed mode start errors
      if (msg.includes('NotAllowedError') || msg.includes('permission') || msg.includes('Permission denied')) {
        setConnectionError('Microphone access denied. Please grant microphone permission in your browser or system settings, then reload.');
      } else {
        setConnectionError(msg);
      }
      handleDisconnect();
    }
  };

  const handleMicChange = useCallback((micId: string) => {
    setSelectedMicId(micId);
    if (pipelineModeRef.current === 'decoupled') {
      micSourceRef.current?.changeDevice(micId);
    } else if (conversationRef.current) {
      conversationRef.current.changeInputDevice({ inputDeviceId: micId }).catch((error) => {
        console.error('Failed to switch input device:', error);
      });
    }
  }, []);

  const handleSpeakerChange = useCallback((speakerId: string) => {
    setSelectedSpeakerId(speakerId);
    if (pipelineModeRef.current === 'decoupled') {
      speakerSinkRef.current?.changeDevice(speakerId);
    } else if (conversationRef.current) {
      conversationRef.current.changeOutputDevice({ outputDeviceId: speakerId }).catch((error) => {
        console.error('Failed to switch output device:', error);
      });
    }
  }, []);

  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    const vol = newValue as number;
    setVolume(vol);
    if (pipelineModeRef.current === 'decoupled') {
      speakerSinkRef.current?.setVolume(vol / 100);
    } else if (conversationRef.current) {
      conversationRef.current.setVolume({ volume: vol / 100 });
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (pipelineModeRef.current === 'decoupled') {
      micSourceRef.current?.setMuted(newMuted);
    } else if (conversationRef.current) {
      conversationRef.current.setMicMuted(newMuted);
    }
  };

  // Send text message to the active conversation.
  // For managed mode: uses conversationRef (not isConnected state) as the primary guard.
  // For decoupled mode: injects a TranscriptionFrame(isFinal=true) into the pipeline.
  const sendTextMessage = useCallback((message: string) => {
    if (!message.trim()) {
      console.warn('Cannot send message: empty message');
      return;
    }

    if (pipelineModeRef.current === 'decoupled') {
      if (!pipelineRef.current) {
        console.warn('Cannot send message: no active pipeline');
        return;
      }
      console.log('Sending text message (decoupled):', message);
      setConversationLog(prev => [...prev, { speaker: 'You', text: message }]);
      // Inject a final TranscriptionFrame to trigger the LLM
      pipelineRef.current.pushFrame(
        transcription(message, true),
        FrameDirection.Downstream,
      );
      return;
    }

    if (!conversationRef.current) {
      console.warn('Cannot send message: no active conversation');
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
    connectionError,
    handleMicChange,
    handleSpeakerChange,
    handleVolumeChange,
    toggleMute,
    handleConnect,
    handleDisconnect,
    sendTextMessage,
  };
};
