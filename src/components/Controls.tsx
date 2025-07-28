import React from 'react';
import { Button, IconButton, Box } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';

interface ControlsProps {
  isConnected: boolean;
  isMuted: boolean;
  handleConnect: () => void;
  handleDisconnect: () => void;
  toggleMute: () => void;
  selectedMicId: string;
}

const Controls: React.FC<ControlsProps> = ({ 
  isConnected, 
  isMuted, 
  handleConnect, 
  handleDisconnect, 
  toggleMute, 
  selectedMicId 
}) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
      {!isConnected ? (
        <Button 
          variant="contained" 
          onClick={handleConnect} 
          disabled={!selectedMicId}
          sx={{ padding: '10px 20px', fontSize: '16px' }}
        >
          Connect and Talk
        </Button>
      ) : (
        <Button 
          variant="contained" 
          color="secondary" 
          onClick={handleDisconnect}
          sx={{ padding: '10px 20px', fontSize: '16px' }}
        >
          Disconnect
        </Button>
      )}
      <IconButton onClick={toggleMute} disabled={!isConnected}>
        {isMuted ? <MicOffIcon /> : <MicIcon />}
      </IconButton>
    </Box>
  );
};

export default Controls;