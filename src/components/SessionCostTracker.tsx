import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { AccessTime, AttachMoney } from '@mui/icons-material';

interface SessionCostTrackerProps {
  isConnected: boolean;
  sessionStartTime: number | null;
  tokenUsage: {
    inputAudioTokens: number;
    outputAudioTokens: number;
    inputTextTokens: number;
    outputTextTokens: number;
  };
  selectedModel: string;
}

const SessionCostTracker: React.FC<SessionCostTrackerProps> = ({
  isConnected,
  sessionStartTime,
  tokenUsage,
  selectedModel,
}) => {
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [currentCost, setCurrentCost] = useState(0);

  // Pricing per million tokens (audio)
  const audioTokenPricing = {
    'gpt-4o-realtime-preview': {
      input: 40,  // $40 per 1M input audio tokens
      output: 80, // $80 per 1M output audio tokens
    },
    'gpt-4o-mini-realtime-preview': {
      input: 10,  // $10 per 1M input audio tokens
      output: 20, // $20 per 1M output audio tokens
    },
  };

  // Calculate cost based on token usage
  useEffect(() => {
    const pricing = audioTokenPricing[selectedModel as keyof typeof audioTokenPricing] || audioTokenPricing['gpt-4o-realtime-preview'];
    
    // Calculate audio token costs
    const inputAudioCost = (tokenUsage.inputAudioTokens / 1_000_000) * pricing.input;
    const outputAudioCost = (tokenUsage.outputAudioTokens / 1_000_000) * pricing.output;
    
    // For text tokens, using the text pricing from docs
    const textPricing = selectedModel === 'gpt-4o-mini-realtime-preview' 
      ? { input: 0.6, output: 2.4 }  // $0.60/$2.40 per 1M tokens
      : { input: 5, output: 20 };    // $5/$20 per 1M tokens
    
    const inputTextCost = (tokenUsage.inputTextTokens / 1_000_000) * textPricing.input;
    const outputTextCost = (tokenUsage.outputTextTokens / 1_000_000) * textPricing.output;
    
    const totalCost = inputAudioCost + outputAudioCost + inputTextCost + outputTextCost;
    setCurrentCost(totalCost);
  }, [tokenUsage, selectedModel]);

  // Update elapsed time
  useEffect(() => {
    if (!isConnected || !sessionStartTime) {
      setElapsedTime('00:00');
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, sessionStartTime]);

  if (!isConnected) {
    return null;
  }

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccessTime color="primary" />
        <Box>
          <Typography variant="caption" color="text.secondary">
            Session Time
          </Typography>
          <Typography variant="h6">{elapsedTime}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AttachMoney color="primary" />
        <Box>
          <Typography variant="caption" color="text.secondary">
            Estimated Cost
          </Typography>
          <Typography variant="h6">${currentCost.toFixed(4)}</Typography>
        </Box>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          Tokens Used
        </Typography>
        <Typography variant="body2">
          Audio: {(tokenUsage.inputAudioTokens + tokenUsage.outputAudioTokens).toLocaleString()}
        </Typography>
        <Typography variant="body2">
          Text: {(tokenUsage.inputTextTokens + tokenUsage.outputTextTokens).toLocaleString()}
        </Typography>
      </Box>
    </Paper>
  );
};

export default SessionCostTracker;
