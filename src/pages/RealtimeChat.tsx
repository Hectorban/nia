import { Box, Typography, Alert, Button } from '@mui/material';
import { useRealtimeChat } from '../hooks/useRealtimeChat';
import DeviceSettings from '../components/DeviceSettings';
import Controls from '../components/Controls';
import ChatView from '../components/ChatView';
import SessionCostTracker from '../components/SessionCostTracker';
import VoiceIndicator from '../components/VoiceIndicator';
import { useRealtimeSettings } from '../hooks/useRealtimeSettings';
import { useState, useEffect } from 'react';
import { MessageInput } from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import '../chat.scss';

const RealtimeChat = () => {
  const {
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
  } = useRealtimeChat();

  const { settings } = useRealtimeSettings();
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const [messageInput, setMessageInput] = useState('');

  const handleSendMessage = () => {
    if (messageInput.trim() && isConnected) {
      sendTextMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  useEffect(() => {
    setShowKeyWarning(!settings?.elevenlabsApiKey || !settings?.elevenlabsAgentId);
  }, [settings]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', boxSizing: 'border-box' }}>
      {/* API Key Warning */}
      {showKeyWarning && (
        <Alert 
          severity="warning" 
          sx={{ m: 2, mb: 0 }}
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={() => setShowKeyWarning(false)}
            >
              Configure
            </Button>
          }
        >
          ElevenLabs API key or Agent ID is not configured. Please set them in the configuration to use the chat.
        </Alert>
      )}
      
      {/* Main Content */}
      <Box sx={{ display: 'flex', height: '100%', width: '100%', boxSizing: 'border-box', p: 2, gap: 2, overflow: 'hidden' }}>
        {/* Column 1: Agent Section */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between',
          minWidth: 0,
          height: '100%'
        }}>
          {/* Agent Transcription */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
            <Typography variant="h6" gutterBottom>AI Transcript</Typography>
            <Typography variant="body2" sx={{ fontStyle: liveAgentTranscript ? 'italic' : 'normal' }}>
              {liveAgentTranscript || lastAgentTranscript || 'Waiting for response...'}
            </Typography>
          </Box>

          {/* Agent Audio Visualization */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
            {isConnected && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>AI Agent</Typography>
                <VoiceIndicator volume={outputVolume} width={200} height={75} color="#1976d2" />
                <Typography variant="body2" color="text.secondary">
                  {liveAgentTranscript ? 'Speaking...' : 'Listening...'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Agent Device Settings (Speaker only for AI) */}
          <Box sx={{ mt: 'auto' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>AI Audio Output</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Speaker: {audioOutputDevices.find(d => d.deviceId === selectedSpeakerId)?.label || 'Default'}
            </Typography>
          </Box>
        </Box>

        {/* Column 2: Chat Section */}
        <Box sx={{ 
          flex: 2, 
          display: 'flex', 
          flexDirection: 'column',
          minWidth: 0,
          height: '100%'
        }}>
          {/* Session Duration Tracker */}
          <SessionCostTracker
            isConnected={isConnected}
            sessionStartTime={sessionStartTime}
          />

          {/* Controls */}
          <Box sx={{ mb: 2 }}>
            <Controls
              isConnected={isConnected}
              isMuted={isMuted}
              handleConnect={handleConnect}
              handleDisconnect={handleDisconnect}
              toggleMute={toggleMute}
              selectedMicId={selectedMicId}
            />
          </Box>

          {/* Chat View */}
          <ChatView
            conversationLog={conversationLog}
            liveUserTranscript={liveUserTranscript}
            liveAgentTranscript={liveAgentTranscript}
          />
          
          {/* Message Input */}
          <Box sx={{ mt: 2 }}>
            <MessageInput
              placeholder={isConnected ? "Type a message or paste a link..." : "Connect to start chatting"}
              value={messageInput}
              onChange={(_innerHtml, textContent) => setMessageInput(textContent)}
              onSend={handleSendMessage}
              disabled={!isConnected}
              sendDisabled={!isConnected || !messageInput.trim()}
              attachButton={false}
            />
          </Box>
        </Box>

        {/* Column 3: User Section */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between',
          minWidth: 0,
          height: '100%'
        }}>
          {/* User Transcription */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Your Transcript</Typography>
            <Typography variant="body2" sx={{ fontStyle: liveUserTranscript ? 'italic' : 'normal' }}>
              {liveUserTranscript || lastUserTranscript || 'Waiting for speech...'}
            </Typography>
          </Box>

          {/* User Audio Visualization */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
            {isConnected && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>You</Typography>
                <VoiceIndicator volume={inputVolume} width={200} height={75} color="#4caf50" />
              </Box>
            )}
          </Box>

          {/* User Device Settings */}
          <Box sx={{ mt: 'auto' }}>
            <DeviceSettings
              audioInputDevices={audioInputDevices}
              audioOutputDevices={audioOutputDevices}
              selectedMicId={selectedMicId}
              selectedSpeakerId={selectedSpeakerId}
              onMicChange={handleMicChange}
              onSpeakerChange={handleSpeakerChange}
              volume={volume}
              onVolumeChange={handleVolumeChange}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RealtimeChat;