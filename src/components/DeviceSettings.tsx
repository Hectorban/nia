import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Box,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

interface DeviceSettingsProps {
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  selectedMicId: string;
  selectedSpeakerId: string;
  onMicChange: (deviceId: string) => void;
  onSpeakerChange: (deviceId: string) => void;
  volume: number;
  onVolumeChange: (event: Event, newValue: number | number[]) => void;
}

const DeviceSettings: React.FC<DeviceSettingsProps> = ({
  audioInputDevices,
  audioOutputDevices,
  selectedMicId,
  selectedSpeakerId,
  onMicChange,
  onSpeakerChange,
  volume,
  onVolumeChange,
}) => {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
      <Box sx={{ flex: '1 1 300px', minWidth: '200px' }}>
        <FormControl fullWidth>
          <InputLabel>Microphone</InputLabel>
          <Select
            value={selectedMicId}
            onChange={(e) => onMicChange(e.target.value)}
          >
            {audioInputDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ flex: '1 1 300px', minWidth: '200px' }}>
        <FormControl fullWidth>
          <InputLabel>Speaker</InputLabel>
          <Select
            value={selectedSpeakerId}
            onChange={(e) => onSpeakerChange(e.target.value)}
          >
            {audioOutputDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ flex: '1 1 200px', minWidth: '150px', display: 'flex', alignItems: 'center', gap: 2 }}>
        <VolumeUpIcon />
        <Slider
          value={volume}
          onChange={onVolumeChange}
          aria-labelledby="volume-slider"
        />
      </Box>
    </Box>
  );
};

export default DeviceSettings;