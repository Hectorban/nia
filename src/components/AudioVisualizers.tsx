import React from 'react';
import { LiveAudioVisualizer } from 'react-audio-visualize';
import { Box, Typography } from '@mui/material';

interface AudioVisualizersProps {
  userMediaRecorder: MediaRecorder | null;
  agentMediaRecorder: MediaRecorder | null;
}

const AudioVisualizers: React.FC<AudioVisualizersProps> = ({ userMediaRecorder, agentMediaRecorder }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-around', width: '100%', mb: 2 }}>
      <Box sx={{ width: '45%' }}>
        <Typography variant="h6" align="center">You</Typography>
        {userMediaRecorder && (
          <LiveAudioVisualizer
            mediaRecorder={userMediaRecorder}
            width={200}
            height={75}
          />
        )}
      </Box>
      <Box sx={{ width: '45%' }}>
        <Typography variant="h6" align="center">Agent</Typography>
        {agentMediaRecorder && (
          <LiveAudioVisualizer
            mediaRecorder={agentMediaRecorder}
            width={200}
            height={75}
          />
        )}
      </Box>
    </Box>
  );
};

export default AudioVisualizers;