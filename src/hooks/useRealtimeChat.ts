import { useState, useEffect, useRef, useCallback } from 'react';
import { getDeviceSettings, saveDeviceSettings, getOpenAISettings } from '../db';
import { saveSession, calculateSessionCost } from '../db/sessions';

export const useRealtimeChat = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [conversationLog, setConversationLog] = useState<{ speaker: 'You' | 'Agent'; text: string }[]>([]);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAgentTranscript, setLiveAgentTranscript] = useState('');
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

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const userStream = useRef<MediaStream | null>(null);

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
    setUserMediaRecorder(null);
    setAgentMediaRecorder(null);
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
          // Don't immediately clear - let it fade or clear on next response
          setTimeout(() => setLiveAgentTranscript(''), 500);
        }
        break;
        
      // Handle assistant audio transcript (realtime API sends these for audio responses)
      case 'response.audio_transcript.delta':
        console.log('Assistant audio transcript delta:', event.delta);
        if (event.delta) {
          setLiveAgentTranscript(prev => prev + event.delta);
        }
        break;
        
      case 'response.audio_transcript.done':
        console.log('Assistant audio transcript done:', event.transcript);
        if (event.transcript) {
          setConversationLog(prev => [...prev, { speaker: 'Agent', text: event.transcript }]);
          // Don't immediately clear - let it fade or clear on next response
          setTimeout(() => setLiveAgentTranscript(''), 500);
        }
        break;
        
      // Clear live transcripts when a new response starts
      case 'response.created':
        setLiveAgentTranscript('');
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

      pc.ontrack = (e) => {
        if (audioEl.current) {
          audioEl.current.srcObject = e.streams[0];
          if (selectedSpeakerId && typeof (audioEl.current as any).setSinkId === 'function') {
            (audioEl.current as any).setSinkId(selectedSpeakerId);
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
            }
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

  return {
    isConnected,
    conversationLog,
    liveUserTranscript,
    liveAgentTranscript,
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
  };
};