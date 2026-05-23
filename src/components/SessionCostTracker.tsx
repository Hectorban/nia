import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { AccessTime } from '@mui/icons-material';

interface SessionCostTrackerProps {
  isConnected: boolean;
  sessionStartTime: number | null;
}

const SessionCostTracker: React.FC<SessionCostTrackerProps> = ({
  isConnected,
  sessionStartTime,
}) => {
  const [elapsedTime, setElapsedTime] = useState('00:00');

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
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccessTime color="primary" />
        <Box>
          <Typography variant="caption" color="text.secondary">
            Session Duration
          </Typography>
          <Typography variant="h6">{elapsedTime}</Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default SessionCostTracker;