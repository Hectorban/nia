import { useState, useEffect, useRef, useCallback } from 'react';
import { getDeviceSettings, saveDeviceSettings, getOpenAISettings } from '../db';
import { saveSession, calculateSessionCost } from '../db/sessions';
import { VTubeStudioService, findBestExpressionMatch } from '../services/vtubeStudio';
import { FirecrawlService } from '../services/firecrawl';
import { ElevenLabsService } from '../services/elevenlabs';

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
  const [userMediaRecorder, setUserMediaRecorder] = useState<MediaRecorder | null>(null);
  const [agentMediaRecorder, setAgentMediaRecorder] = useState<MediaRecorder | null>(null);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [tokenUsage, setTokenUsage] = useState({
    inputAudioTokens: 0,
    outputAudioTokens: 0,
    inputTextTokens: 0,
    outputTextTokens: 0,
  });
  const [selectedModel, setSelectedModel] = useState('gpt-4o-realtime-preview');
  const [vtubeStudioConnected, setVtubeStudioConnected] = useState(false);
  const [elevenlabsAudio, setElevenlabsAudio] = useState<HTMLAudioElement | null>(null);
  const [isStreamingTTS, setIsStreamingTTS] = useState(false);
  const [streamingBuffer, setStreamingBuffer] = useState<string>('');

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const userStream = useRef<MediaStream | null>(null);
  const vtubeStudioService = useRef<VTubeStudioService | null>(null);
  const elevenlabsService = useRef<ElevenLabsService>(new ElevenLabsService());

  const handleDisconnect = useCallback(async () => {
    console.log('Disconnecting...');
    
    // Save session data before disconnecting
    if (sessionStartTime && conversationLog.length > 0) {
      try {
        const endTime = Date.now();
        const durationSeconds = Math.floor((endTime - sessionStartTime) / 1000);
        
        // Calculate total cost
        const totalCost = calculateSessionCost(tokenUsage);
        
        // Get device names
        const micDevice = audioInputDevices.find(d => d.deviceId === selectedMicId)?.label || 'Default Microphone';
        const speakerDevice = audioOutputDevices.find(d => d.deviceId === selectedSpeakerId)?.label || 'Default Speaker';
        
        // Prepare messages with timestamps
        const messages = conversationLog.map((msg, index) => ({
          speaker: msg.speaker,
          text: msg.text,
          timestamp: sessionStartTime + (index * 1000), // Approximate timestamps
        }));
        
        // Save session to database
        await saveSession(
          {
            start_time: sessionStartTime,
            end_time: endTime,
            duration_seconds: durationSeconds,
            model: selectedModel,
            input_audio_tokens: tokenUsage.inputAudioTokens,
            output_audio_tokens: tokenUsage.outputAudioTokens,
            input_text_tokens: tokenUsage.inputTextTokens,
            output_text_tokens: tokenUsage.outputTextTokens,
            total_cost: totalCost,
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
    
    if (userMediaRecorder && userMediaRecorder.state !== 'inactive') {
      userMediaRecorder.stop();
    }
    if (agentMediaRecorder && agentMediaRecorder.state !== 'inactive') {
      agentMediaRecorder.stop();
    }
    if (userStream.current) {
      userStream.current.getTracks().forEach(track => track.stop());
      userStream.current = null;
    }
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (audioEl.current) {
      audioEl.current.srcObject = null;
    }
    if (elevenlabsAudio) {
      elevenlabsAudio.pause();
      elevenlabsAudio.src = '';
      setElevenlabsAudio(null);
    }
    // Close streaming TTS connection if active
    if (elevenlabsService.current.isStreamingActive()) {
      elevenlabsService.current.closeStreamingConnection();
    }
    setIsStreamingTTS(false);
    setStreamingBuffer('');
    setIsConnected(false);
    setLiveUserTranscript('');
    setLiveAgentTranscript('');
    setSessionStartTime(null);
    setTokenUsage({
      inputAudioTokens: 0,
      outputAudioTokens: 0,
      inputTextTokens: 0,
      outputTextTokens: 0,
    });
    console.log('Disconnected');
  }, [userMediaRecorder, agentMediaRecorder, sessionStartTime, conversationLog, tokenUsage, selectedModel, audioInputDevices, audioOutputDevices, selectedMicId, selectedSpeakerId]);

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
      // Only disconnect when component unmounts, not on every re-render
      if (peerConnection.current) {
        handleDisconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAudioDevices]); // Removed handleDisconnect from deps to prevent re-render disconnects

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getDeviceSettings();
      const openAISettings = await getOpenAISettings();
      if (openAISettings?.model) {
        setSelectedModel(openAISettings.model);
      }
      if (settings.selectedMicId) {
        setSelectedMicId(settings.selectedMicId);
      } else {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        if (audioInputs.length > 0) setSelectedMicId(audioInputs[0].deviceId);
      }

      if (settings.selectedSpeakerId) {
        setSelectedSpeakerId(settings.selectedSpeakerId);
      } else {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
        if (audioOutputs.length > 0) setSelectedSpeakerId(audioOutputs[0].deviceId);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const saveSettings = async () => {
      await saveDeviceSettings({ selectedMicId, selectedSpeakerId });
    };

    if (selectedMicId || selectedSpeakerId) {
      saveSettings();
    }
  }, [selectedMicId, selectedSpeakerId]);

  useEffect(() => { if (audioEl.current) audioEl.current.volume = volume / 100; }, [volume]);

  useEffect(() => {
    if (userStream.current) {
      userStream.current.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
    }
  }, [isMuted]);

  const sendClientEvent = (message: any) => {
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      dataChannel.current.send(JSON.stringify(message));
    } else {
      console.error('Data channel not available');
    }
  };

  // Initialize VTube Studio service
  useEffect(() => {
    if (!vtubeStudioService.current) {
      vtubeStudioService.current = VTubeStudioService.getInstance();
      
      // Try to connect to VTube Studio
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

  // Handle URL fetching with Firecrawl
  const handleFetchUrl = async (args: string) => {
    try {
      const parsedArgs = JSON.parse(args);
      const { url, includeScreenshot } = parsedArgs;
      if (!url) {
        return 'Error: URL parameter is required';
      }
      
      // Get Firecrawl API key from settings
      const openAISettings = await getOpenAISettings();
      const firecrawlApiKey = openAISettings?.firecrawlApiKey;
      
      if (!firecrawlApiKey) {
        return 'Error: Firecrawl API key is not configured. Please set it in the configuration.';
      }
      
      console.log('Fetching URL content:', url, includeScreenshot ? '(with screenshot)' : '');
      console.log('Using Firecrawl API key:', firecrawlApiKey ? 'Present' : 'Missing');
      
      const response = await FirecrawlService.scrapeWithApiKey(url, firecrawlApiKey, includeScreenshot);
      console.log('Firecrawl response received:', { 
        success: response.success, 
        hasMarkdown: !!response.markdown, 
        hasScreenshot: !!response.screenshot || !!(response.actions?.screenshots?.length),
        error: response.error 
      });
      
      if (!response.success) {
        console.error('Firecrawl API error:', response.error);
        return `Error fetching URL: ${response.error}`;
      }
      
      if (!response.markdown) {
        console.error('No markdown content in Firecrawl response');
        return 'Error: No content retrieved from URL';
      }
      
      const { markdown, metadata, screenshot, actions } = response;
      const title = metadata?.title || 'Unknown Title';
      const description = metadata?.description || '';
      
      // Get screenshot URL (can be in screenshot field or actions.screenshots array)
      const screenshotUrl = screenshot || actions?.screenshots?.[0];
      
      console.log('Successfully processed URL content:', { 
        title, 
        contentLength: markdown?.length || 0,
        hasScreenshot: !!screenshotUrl
      });
      
      // Return formatted content with optional screenshot
      let result = `Successfully fetched content from: ${url}\n\nTitle: ${title}\n${description ? `Description: ${description}\n` : ''}`;
      
      if (screenshotUrl) {
        result += `\nScreenshot: ${screenshotUrl}\n`;
      }
      
      result += `\nContent:\n${markdown}`;
      
      return result;
    } catch (error) {
      console.error('Failed to fetch URL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `Failed to fetch URL: ${errorMessage}`;
    }
  };

  // Handle screenshot URL function call
  const handleScreenshotUrl = async (args: string) => {
    try {
      const parsedArgs = JSON.parse(args);
      const { url } = parsedArgs;
      if (!url) {
        return 'Error: URL parameter is required';
      }
      
      // Get Firecrawl API key from settings
      const openAISettings = await getOpenAISettings();
      const firecrawlApiKey = openAISettings?.firecrawlApiKey;
      
      if (!firecrawlApiKey) {
        return 'Error: Firecrawl API key is not configured. Please set it in the configuration.';
      }
      
      console.log('Taking screenshot of URL:', url);
      console.log('Using Firecrawl API key:', firecrawlApiKey ? 'Present' : 'Missing');
      
      const response = await FirecrawlService.scrapeWithApiKey(url, firecrawlApiKey, true);
      console.log('Firecrawl screenshot response received:', { 
        success: response.success, 
        hasScreenshot: !!response.screenshot || !!(response.actions?.screenshots?.length),
        error: response.error 
      });
      
      if (!response.success) {
        console.error('Firecrawl API error:', response.error);
        return `Error taking screenshot: ${response.error}`;
      }
      
      // Get screenshot URL (can be in screenshot field or actions.screenshots array)
      const screenshotUrl = response.screenshot || response.actions?.screenshots?.[0];
      
      if (!screenshotUrl) {
        console.error('No screenshot in Firecrawl response');
        return 'Error: No screenshot was captured from the URL';
      }
      
      const { metadata } = response;
      const title = metadata?.title || 'Unknown Title';
      
      console.log('Successfully captured screenshot:', { title, screenshotUrl });
      
      return `Successfully captured screenshot of: ${url}\n\nTitle: ${title}\nScreenshot: ${screenshotUrl}`;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `Failed to take screenshot: ${errorMessage}`;
    }
  };

  // Handle function calls from OpenAI Realtime API
  const handleFunctionCall = async (functionCall: any) => {
    console.log('Handling function call:', functionCall);
    
    try {
      const { name, arguments: args, call_id } = functionCall;
      let result = '';
      
      switch (name) {
        case 'change_expression':
          result = await handleExpressionChange(args);
          break;
        case 'trigger_emotion':
          result = await handleEmotionTrigger(args);
          break;
        case 'fetch_url':
          result = await handleFetchUrl(args);
          break;
        case 'screenshot_url':
          result = await handleScreenshotUrl(args);
          break;
        default:
          result = `Unknown function: ${name}`;
          console.warn('Unknown function call:', name);
      }
      
      // Send function call result back to OpenAI
      console.log('Function call completed:', { name, call_id, resultLength: result?.length || 0 });
      
      if (call_id) {
        console.log('Sending function result back to OpenAI...');
        sendClientEvent({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: call_id,
            output: JSON.stringify({ success: true, result })
          }
        });
        
        console.log('Triggering new AI response...');
        // Trigger a new response
        sendClientEvent({
          type: 'response.create'
        });
        console.log('Response creation event sent');
      } else {
        console.warn('No call_id provided, cannot send function result back');
      }
    } catch (error) {
      console.error('Error handling function call:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (functionCall.call_id) {
        sendClientEvent({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: functionCall.call_id,
            output: JSON.stringify({ success: false, error: errorMessage })
          }
        });
      }
    }
  };

  // Handle VTube Studio expression changes
  const handleExpressionChange = async (args: string) => {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    const { expression, duration } = parsedArgs;
    
    if (!vtubeStudioService.current || !vtubeStudioConnected) {
      return 'VTube Studio not connected';
    }
    
    try {
      await vtubeStudioService.current.activateExpression(expression, duration);
      return `Successfully activated expression: ${expression}`;
    } catch (error) {
      console.error('Failed to activate expression:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `Failed to activate expression: ${errorMessage}`;
    }
  };

  // Handle emotion-based expression triggering
  const handleEmotionTrigger = async (args: string) => {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    const { emotion, duration } = parsedArgs;
    
    if (!vtubeStudioService.current || !vtubeStudioConnected) {
      return 'VTube Studio not connected';
    }
    
    try {
      // Get available expressions and find best match
      const expressions = await vtubeStudioService.current.getExpressions();
      const bestMatch = findBestExpressionMatch(emotion, expressions);
      
      if (!bestMatch) {
        return `No suitable expression found for emotion: ${emotion}`;
      }
      
      await vtubeStudioService.current.activateExpression(bestMatch, duration || 3);
      return `Triggered ${emotion} emotion with expression: ${bestMatch}`;
    } catch (error) {
      console.error('Failed to trigger emotion:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `Failed to trigger emotion: ${errorMessage}`;
    }
  };

  const handleTTSPlayback = async (transcript: string) => {
    try {
      const settings = await getOpenAISettings();
      console.log('TTS Settings Debug:', {
        ttsProvider: settings?.ttsProvider,
        elevenlabsApiKey: settings?.elevenlabsApiKey ? '[PRESENT]' : '[MISSING]',
        elevenlabsVoiceId: settings?.elevenlabsVoiceId,
        hasAllElevenLabsSettings: !!(settings?.ttsProvider === 'elevenlabs' && settings?.elevenlabsApiKey && settings?.elevenlabsVoiceId)
      });
      
      // Only use ElevenLabs if selected and configured
      if (settings?.ttsProvider === 'elevenlabs' && settings?.elevenlabsApiKey && settings?.elevenlabsVoiceId) {
        console.log('Playing transcript with ElevenLabs TTS:', transcript);
        
        // Stop any existing ElevenLabs audio
        if (elevenlabsAudio) {
          elevenlabsAudio.pause();
          elevenlabsAudio.src = '';
        }
        
        // Configure and play ElevenLabs TTS
        elevenlabsService.current.setApiKey(settings.elevenlabsApiKey);
        const audio = await elevenlabsService.current.playText(transcript, settings.elevenlabsVoiceId, elevenlabsAudio || undefined, {
          language: settings.language || 'es'
        });
        setElevenlabsAudio(audio);
      } else {
        // Use OpenAI TTS (default behavior)
        console.log('Using OpenAI TTS (default)');
      }
    } catch (error) {
      console.error('Failed to handle TTS playback:', error);
    }
  };

  const initializeStreamingTTS = async () => {
    try {
      const settings = await getOpenAISettings();
      
      // Only initialize streaming if ElevenLabs is selected and configured
      if (settings?.ttsProvider === 'elevenlabs' && settings?.elevenlabsApiKey && settings?.elevenlabsVoiceId) {
        console.log('Initializing ElevenLabs streaming TTS...');
        
        elevenlabsService.current.setApiKey(settings.elevenlabsApiKey);
        
        // Close any existing streaming connection
        if (elevenlabsService.current.isStreamingActive()) {
          elevenlabsService.current.closeStreamingConnection();
        }
        
        // Create new streaming connection
        await elevenlabsService.current.createStreamingConnection(
          settings.elevenlabsVoiceId,
          {
            model: 'eleven_multilingual_v2',
            language: settings.language || 'es',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              style: 0.0,
              use_speaker_boost: true
            },
            output_format: 'mp3_44100_128'
          },
          elevenlabsAudio || undefined
        );
        
        setIsStreamingTTS(true);
        setStreamingBuffer('');
        
        console.log('ElevenLabs streaming TTS initialized successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to initialize streaming TTS:', error);
      setIsStreamingTTS(false);
      return false;
    }
  };

  const handleStreamingTextChunk = (textChunk: string) => {
    if (!isStreamingTTS || !elevenlabsService.current.isStreamingActive()) {
      return;
    }
    
    try {
      // Send text chunk to streaming TTS
      const success = elevenlabsService.current.sendTextToStream(textChunk);
      if (success) {
        setStreamingBuffer(prev => prev + textChunk);
        console.log('Sent text chunk to streaming TTS:', textChunk);
      }
    } catch (error) {
      console.error('Failed to send text chunk to streaming TTS:', error);
    }
  };

  const finishStreamingTTS = () => {
    if (!isStreamingTTS || !elevenlabsService.current.isStreamingActive()) {
      return;
    }
    
    try {
      // Flush the stream to get remaining audio
      elevenlabsService.current.flushStream();
      console.log('Flushed streaming TTS, total text:', streamingBuffer);
    } catch (error) {
      console.error('Failed to finish streaming TTS:', error);
    }
  };

  const handleServerEvent = (event: any) => {
    console.log('Received event:', event.type, event);
    
    switch (event.type) {
      // Handle incremental transcript updates
      case 'conversation.item.input_audio_transcription.delta':
        // User's transcript delta
        console.log('User transcript delta:', event.delta);
        if (event.delta) {
          setLiveUserTranscript(prev => prev + event.delta);
        }
        break;
        
      // Handle completed transcripts
      case 'conversation.item.input_audio_transcription.completed':
        // User's completed transcript
        if (event.transcript) {
          setConversationLog(prev => [...prev, { speaker: 'You', text: event.transcript }]);
          // Save the last transcript before clearing
          setLastUserTranscript(event.transcript);
          // Don't immediately clear - let it fade or clear on next delta
          setTimeout(() => setLiveUserTranscript(''), 500);
        }
        break;
        
      // Handle assistant text responses (for text content)
      case 'response.text.delta':
        console.log('Assistant text delta:', event.delta);
        if (event.delta) {
          setLiveAgentTranscript(prev => prev + event.delta);
        }
        break;
        
      case 'response.text.done':
        if (event.text) {
          setConversationLog(prev => [...prev, { speaker: 'Agent', text: event.text }]);
          // Save the last transcript before clearing
          setLastAgentTranscript(event.text);
          // Don't immediately clear - let it fade or clear on next response
          setTimeout(() => setLiveAgentTranscript(''), 500);
        }
        break;
        
      // Handle assistant audio transcript (realtime API sends these for audio responses)
      case 'response.audio_transcript.delta':
        console.log('Assistant audio transcript delta:', event.delta);
        if (event.delta) {
          setLiveAgentTranscript(prev => prev + event.delta);
          // Send text chunk to streaming TTS if active
          handleStreamingTextChunk(event.delta);
        }
        break;
        
      case 'response.audio_transcript.done':
        console.log('Assistant audio transcript done:', event.transcript);
        if (event.transcript) {
          setConversationLog(prev => [...prev, { speaker: 'Agent', text: event.transcript }]);
          // Save the last transcript before clearing
          setLastAgentTranscript(event.transcript);
          
          // Finish streaming TTS if active, otherwise use traditional TTS
          if (isStreamingTTS && elevenlabsService.current.isStreamingActive()) {
            finishStreamingTTS();
          } else {
            // Handle ElevenLabs TTS if selected (non-blocking)
            handleTTSPlayback(event.transcript).catch((error: unknown) => {
              console.error('Failed to play TTS:', error);
            });
          }
          
          // Don't immediately clear - let it fade or clear on next response
          setTimeout(() => setLiveAgentTranscript(''), 500);
        }
        break;
        
      // Clear live transcripts when a new response starts
      case 'response.created':
        setLiveAgentTranscript('');
        // Initialize streaming TTS for this response if ElevenLabs is selected
        initializeStreamingTTS().catch((error: unknown) => {
          console.error('Failed to initialize streaming TTS:', error);
        });
        break;
        
      // Clear user transcript when new input starts
      case 'input_audio_buffer.speech_started':
        setLiveUserTranscript('');
        break;
      
      case 'response.done':
        // Update token usage when response is complete
        if (event.response?.usage) {
          const usage = event.response.usage;
          setTokenUsage(prev => ({
            inputAudioTokens: prev.inputAudioTokens + (usage.input_token_details?.audio_tokens || 0),
            outputAudioTokens: prev.outputAudioTokens + (usage.output_token_details?.audio_tokens || 0),
            inputTextTokens: prev.inputTextTokens + (usage.input_token_details?.text_tokens || 0),
            outputTextTokens: prev.outputTextTokens + (usage.output_token_details?.text_tokens || 0),
          }));
        }
        
        // Handle function calls in the response
        if (event.response?.output) {
          for (const output of event.response.output) {
            if (output.type === 'function_call') {
              handleFunctionCall(output);
            }
          }
        }
        break;
        
      case 'response.function_call_arguments.done':
        // Handle completed function call arguments
        if (event.call_id && event.name && event.arguments) {
          handleFunctionCall({
            call_id: event.call_id,
            name: event.name,
            arguments: event.arguments
          });
        }
        break;
    }
  };

  const handleConnect = async () => {
    console.log('=== handleConnect START ===');
    try {
      console.log('handleConnect called, selectedMicId:', selectedMicId);
      if (!selectedMicId) {
        console.log('No microphone selected, returning');
        return;
      }
      console.log('Getting OpenAI settings...');
      const openAISettings = await getOpenAISettings();
      const apiKey = openAISettings?.apiKey;
      console.log('API Key found:', !!apiKey);
      if (!apiKey) throw new Error('OpenAI API key is not configured. Please set it in the configuration.');

      // Validate API key by listing models
      console.log('Validating API key...');
      const modelsResponse = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      if (!modelsResponse.ok) {
        const error = await modelsResponse.text();
        console.error('API key validation failed:', modelsResponse.status, error);
        throw new Error(`Invalid API key: ${modelsResponse.status} ${error}`);
      }
      console.log('API key validated successfully');

      console.log('Creating RTCPeerConnection...');
      // Add ICE servers configuration
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnection.current = pc;

      pc.ontrack = async (e) => {
        if (audioEl.current) {
          audioEl.current.srcObject = e.streams[0];
          if (selectedSpeakerId && typeof (audioEl.current as any).setSinkId === 'function') {
            (audioEl.current as any).setSinkId(selectedSpeakerId);
          }
          
          // Check TTS provider setting and mute OpenAI audio if ElevenLabs is selected
          try {
            const settings = await getOpenAISettings();
            console.log('Connection TTS Settings Debug:', {
              ttsProvider: settings?.ttsProvider,
              elevenlabsApiKey: settings?.elevenlabsApiKey ? '[PRESENT]' : '[MISSING]',
              elevenlabsVoiceId: settings?.elevenlabsVoiceId,
              hasAllElevenLabsSettings: !!(settings?.ttsProvider === 'elevenlabs' && settings?.elevenlabsApiKey && settings?.elevenlabsVoiceId)
            });
            if (settings?.ttsProvider === 'elevenlabs' && settings?.elevenlabsApiKey && settings?.elevenlabsVoiceId) {
              console.log('ElevenLabs TTS selected - muting OpenAI audio permanently');
              audioEl.current.muted = true;
              // Set volume to 0 as additional safeguard
              audioEl.current.volume = 0;
            } else {
              console.log('OpenAI TTS selected - enabling OpenAI audio');
              audioEl.current.muted = false;
              audioEl.current.volume = volume / 100;
            }
          } catch (error) {
            console.error('Error checking TTS provider, defaulting to OpenAI audio:', error);
            audioEl.current.muted = false;
            audioEl.current.volume = volume / 100;
          }
          
          const agentRecorder = new MediaRecorder(e.streams[0]);
          agentRecorder.start();
          setAgentMediaRecorder(agentRecorder);
        }
      };

      console.log('Getting user media stream...');
      const ms = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          deviceId: selectedMicId ? { exact: selectedMicId } : undefined
        } 
      });
      console.log('Got media stream:', ms.id);
      userStream.current = ms;
      
      // Get the first audio track only (matching working example)
      const audioTrack = ms.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('No audio track found in media stream');
      }
      
      audioTrack.enabled = !isMuted;
      console.log('Audio track:', audioTrack.label, 'enabled:', audioTrack.enabled);
      
      const userRecorder = new MediaRecorder(ms);
      userRecorder.start();
      setUserMediaRecorder(userRecorder);
      
      console.log('Adding audio track to peer connection...');
      pc.addTrack(audioTrack, ms);

      // Create data channel before adding tracks (matching working example order)
      const dc = pc.createDataChannel('oai-events');
      dataChannel.current = dc;
      dc.onopen = async () => {
        setIsConnected(true);
        setSessionStartTime(Date.now());
        const openAISettings = await getOpenAISettings();
        sendClientEvent({ 
          type: 'session.update', 
          session: { 
            voice: openAISettings?.voice || 'alloy',
            instructions: openAISettings?.prompt || undefined,
            input_audio_transcription: {
              model: 'gpt-4o-transcribe'
            },
            tools: [
              {
                type: 'function',
                name: 'change_expression',
                description: 'Change the VTube Studio model expression to convey emotions and reactions during conversation.',
                parameters: {
                  type: 'object',
                  properties: {
                    expression: {
                      type: 'string',
                      description: 'The name of the expression to activate (e.g., "happy", "sad", "surprised", "wink")'
                    },
                    duration: {
                      type: 'number',
                      description: 'Duration in seconds to keep the expression active (optional, defaults to 3 seconds)'
                    }
                  },
                  required: ['expression']
                }
              },
              {
                type: 'function',
                name: 'trigger_emotion',
                description: 'Trigger an emotion-based expression that best matches the feeling you want to convey. The system will automatically find the best matching expression from available options.',
                parameters: {
                  type: 'object',
                  properties: {
                    emotion: {
                      type: 'string',
                      description: 'The emotion to express',
                      enum: ['happy', 'sad', 'angry', 'surprised', 'confused', 'excited', 'sleepy', 'wink', 'neutral']
                    },
                    duration: {
                      type: 'number',
                      description: 'Duration in seconds to keep the expression active (optional, defaults to 3 seconds)'
                    }
                  },
                  required: ['emotion']
                }
              },
              {
                type: 'function',
                name: 'fetch_url',
                description: 'Fetch and read the content of a web page URL. This allows me to access and read information from websites that users share.',
                parameters: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      description: 'The URL to fetch content from (e.g., "https://example.com")'
                    },
                    includeScreenshot: {
                      type: 'boolean',
                      description: 'Whether to also capture a screenshot of the webpage (optional, defaults to true)',
                      default: true
                    }
                  },
                  required: ['url']
                }
              },
              {
                type: 'function',
                name: 'screenshot_url',
                description: 'Take a screenshot of a web page URL. This captures a visual representation of how the webpage appears.',
                parameters: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      description: 'The URL to take a screenshot of (e.g., "https://example.com")'
                    }
                  },
                  required: ['url']
                }
              }
            ],
            tool_choice: 'auto'
          } 
        });
      };
      dc.onmessage = (e) => handleServerEvent(JSON.parse(e.data));

      console.log('Creating offer...');
      let offer: RTCSessionDescriptionInit;
      try {
        offer = await pc.createOffer();
        console.log('Offer created successfully');
        console.log('Offer SDP length:', offer.sdp?.length);
        console.log('Offer type:', offer.type);
        console.log('Setting local description...');
        try {
          await pc.setLocalDescription(offer);
          console.log('Local description set successfully');
        } catch (setLocalDescError: any) {
          console.error('ERROR setting local description:', setLocalDescError);
          console.error('Error details:', {
            name: setLocalDescError?.name,
            message: setLocalDescError?.message,
            code: setLocalDescError?.code,
            stack: setLocalDescError?.stack
          });
          throw setLocalDescError;
        }
      } catch (offerError: any) {
        console.error('Error creating/setting offer:', offerError);
        console.error('Error name:', offerError?.name);
        console.error('Error message:', offerError?.message);
        console.error('Error code:', offerError?.code);
        // Log the current state of the peer connection
        console.error('PC connection state:', pc.connectionState);
        console.error('PC signaling state:', pc.signalingState);
        console.error('PC ice connection state:', pc.iceConnectionState);
        console.error('PC ice gathering state:', pc.iceGatheringState);
        throw offerError;
      }

      console.log('Sending request to OpenAI API...');
      console.log('URL:', `https://api.openai.com/v1/realtime?model=${selectedModel}`);
      const res = await fetch(`https://api.openai.com/v1/realtime?model=${selectedModel}`, {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/sdp' },
      });

      console.log('Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to connect: ${res.status} ${errorText}`);
      }

      const answerSdp = await res.text();
      console.log('Setting remote description...');
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
    } catch (error) {
      console.error('=== handleConnect ERROR CAUGHT ===');
      console.error('Error type:', typeof error);
      console.error('Error connecting:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      } else {
        console.error('Non-Error object:', JSON.stringify(error));
      }
      handleDisconnect();
    } finally {
      console.log('=== handleConnect END ===');
    }
  };

  const handleMicChange = (micId: string) => setSelectedMicId(micId);
  const handleSpeakerChange = (speakerId: string) => {
    setSelectedSpeakerId(speakerId);
    if (audioEl.current && typeof (audioEl.current as any).setSinkId === 'function') {
        (audioEl.current as any).setSinkId(speakerId);
    }
  }
  const handleVolumeChange = (_event: Event, newValue: number | number[]) => setVolume(newValue as number);
  const toggleMute = () => setIsMuted(!isMuted);

  // Send text message to the realtime session
  const sendTextMessage = useCallback((message: string) => {
    if (!isConnected || !message.trim()) {
      console.warn('Cannot send message: not connected or empty message');
      return;
    }

    console.log('Sending text message:', message);
    
    // Add the message to conversation log immediately
    setConversationLog(prev => [...prev, { speaker: 'You', text: message }]);
    
    // Send the message as a conversation item to OpenAI
    sendClientEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: message
        }]
      }
    });
    
    // Trigger a response from the assistant
    sendClientEvent({
      type: 'response.create'
    });
  }, [isConnected]);

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
    userMediaRecorder,
    agentMediaRecorder,
    volume,
    isMuted,
    sessionStartTime,
    tokenUsage,
    selectedModel,
    handleMicChange,
    handleSpeakerChange,
    handleVolumeChange,
    toggleMute,
    handleConnect,
    handleDisconnect,
    audioEl,
    sendTextMessage,
  };
};