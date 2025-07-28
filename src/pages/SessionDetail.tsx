import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  List,
  ListItem,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  AccessTime as TimeIcon,
  AttachMoney as MoneyIcon,
  Mic as MicIcon,
  Speaker as SpeakerIcon,
} from '@mui/icons-material';
import { getSessionWithMessages, type Session, type Message } from '../db/sessions';
import { format } from 'date-fns';

interface SessionDetailProps {
  sessionId: number;
  onBack: () => void;
}

const SessionDetail = ({ sessionId, onBack }: SessionDetailProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const data = await getSessionWithMessages(sessionId);
        if (data) {
          setSession(data.session);
          setMessages(data.messages);
        } else {
          // Session not found, go back to sessions list
          onBack();
        }
      } catch (error) {
        console.error('Error loading session:', error);
      }
    };

    loadSession();
  }, [sessionId, onBack]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (!session) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={onBack}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4">
          Session Details
        </Typography>
      </Box>

      {/* Session Info */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Session Information
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mt: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Date & Time</Typography>
            <Typography>{format(new Date((session.start_time || 0) * 1000), 'MMMM d, yyyy h:mm a')}</Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">Duration</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TimeIcon fontSize="small" />
              <Typography>{formatDuration(session.duration_seconds)}</Typography>
            </Box>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">Total Cost</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MoneyIcon fontSize="small" />
              <Typography>${session.total_cost.toFixed(2)}</Typography>
            </Box>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">Model</Typography>
            <Chip label={session.model} size="small" color="primary" />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>
          Token Usage
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mt: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Input Audio</Typography>
            <Typography>{session.input_audio_tokens.toLocaleString()} tokens</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Output Audio</Typography>
            <Typography>{session.output_audio_tokens.toLocaleString()} tokens</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Input Text</Typography>
            <Typography>{session.input_text_tokens.toLocaleString()} tokens</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Output Text</Typography>
            <Typography>{session.output_text_tokens.toLocaleString()} tokens</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>
          Devices Used
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MicIcon fontSize="small" />
            <Box>
              <Typography variant="body2" color="text.secondary">Microphone</Typography>
              <Typography variant="body2">{session.mic_device || 'Default'}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SpeakerIcon fontSize="small" />
            <Box>
              <Typography variant="body2" color="text.secondary">Speaker</Typography>
              <Typography variant="body2">{session.speaker_device || 'Default'}</Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Messages */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Conversation ({messages.length} messages)
        </Typography>
        
        <List>
          {messages.map((message) => (
            <ListItem
              key={message.id}
              alignItems="flex-start"
              sx={{
                flexDirection: message.speaker === 'You' ? 'row' : 'row-reverse',
                gap: 2,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: message.speaker === 'You' ? 'primary.main' : 'secondary.main',
                }}
              >
                {message.speaker === 'You' ? <PersonIcon /> : <BotIcon />}
              </Avatar>
              <Box
                sx={{
                  flex: 1,
                  maxWidth: '70%',
                }}
              >
                <Paper
                  elevation={1}
                  sx={{
                    p: 2,
                    bgcolor: message.speaker === 'You' ? 'primary.50' : 'grey.100',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {message.speaker}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(message.timestamp), 'h:mm:ss a')}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.text}
                  </Typography>
                </Paper>
              </Box>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default SessionDetail;
