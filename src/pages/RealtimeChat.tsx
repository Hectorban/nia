import { Box, Typography, Alert, Button } from '@mui/material';
import { useRealtimeChat } from '../hooks/useRealtimeChat';
import { LiveAudioVisualizer } from 'react-audio-visualize';
import DeviceSettings from '../components/DeviceSettings';
import Controls from '../components/Controls';
import ChatView from '../components/ChatView';
import SessionCostTracker from '../components/SessionCostTracker';
import { useOpenAISettings } from '../hooks/useOpenAISettings';
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
  } = useRealtimeChat();

  const { settings } = useOpenAISettings();
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(false);
  const [messageInput, setMessageInput] = useState('');

  const handleSendMessage = () => {
    if (messageInput.trim() && isConnected) {
      sendTextMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  useEffect(() => {
    setShowApiKeyWarning(!settings?.apiKey);
  }, [settings]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', boxSizing: 'border-box' }}>
      {/* API Key Warning */}
      {showApiKeyWarning && (
        <Alert 
          severity="warning" 
          sx={{ m: 2, mb: 0 }}
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={() => {
                // Navigate to configuration - you'll need to implement this
                // For now, we'll just hide the warning
                setShowApiKeyWarning(false);
              }}
            >
              Configure
            </Button>
          }
        >
          OpenAI API key is not configured. Please set your API key in the configuration to use the chat.
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
        minWidth: 0, // Prevent flex item from overflowing
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
          {agentMediaRecorder && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>AI Agent</Typography>
              <LiveAudioVisualizer
                mediaRecorder={agentMediaRecorder}
                width={200}
                height={75}
              />
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
        minWidth: 0, // Prevent flex item from overflowing
        height: '100%'
      }}>
        {/* Session Cost Tracker */}
        <SessionCostTracker
          isConnected={isConnected}
          sessionStartTime={sessionStartTime}
          tokenUsage={tokenUsage}
          selectedModel={selectedModel}
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
        minWidth: 0, // Prevent flex item from overflowing
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
          {userMediaRecorder && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>You</Typography>
              <LiveAudioVisualizer
                mediaRecorder={userMediaRecorder}
                width={200}
                height={75}
              />
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

    <audio ref={audioEl} autoPlay style={{ display: 'none' }} />
  </Box>
  );
};

export default RealtimeChat;
