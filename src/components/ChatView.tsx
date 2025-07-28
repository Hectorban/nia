import React from 'react';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
} from "@chatscope/chat-ui-kit-react";
import { Paper, Box } from '@mui/material';

interface ChatViewProps {
  conversationLog: { speaker: 'You' | 'Agent'; text: string }[];
  liveUserTranscript: string;
  liveAgentTranscript: string;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  conversationLog, 
  liveUserTranscript, 
  liveAgentTranscript 
}) => {
  return (
    <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Paper elevation={3} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        <MainContainer>
          <ChatContainer>
            <MessageList>
              {conversationLog.map((msg, index) => (
                <Message
                  key={index}
                  model={{
                    message: msg.text,
                    direction: msg.speaker === 'You' ? 'outgoing' : 'incoming',
                    sender: msg.speaker,
                    position: 'single',
                  }}
                />
              ))}
              {liveUserTranscript && (
                <Message
                  model={{
                    message: `*${liveUserTranscript}*`,
                    direction: 'outgoing',
                    sender: 'You',
                    position: 'single',
                  }}
                />
              )}
              {liveAgentTranscript && (
                <Message
                  model={{
                    message: `*${liveAgentTranscript}*`,
                    direction: 'incoming',
                    sender: 'Agent',
                    position: 'single',
                  }}
                />
              )}
            </MessageList>
          </ChatContainer>
        </MainContainer>
      </Paper>
    </Box>
  );
};

export default ChatView;