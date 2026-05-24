import { Box } from '@mui/material';

interface VoiceIndicatorProps {
  volume: number;       // 0–1 scalar from the SDK
  width?: number;
  height?: number;
  color?: string;
  barCount?: number;    // number of bars in the indicator
}

/**
 * Simple volume bar indicator driven by a 0–1 scalar.
 * Replaces the old MediaRecorder-based LiveAudioVisualizer.
 */
const VoiceIndicator = ({
  volume,
  width = 200,
  height = 75,
  color = '#4caf50',
  barCount = 20,
}: VoiceIndicatorProps) => {
  const activeBars = Math.round(volume * barCount);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: '2px',
        width,
        height,
        p: '2px',
      }}
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const isActive = i < activeBars;
        const barHeight = isActive
          ? `${Math.max(8, (height - 8) * ((i + 1) / barCount))}px`
          : '4px';
        return (
          <Box
            key={i}
            sx={{
              width: `${Math.floor((width - (barCount - 1) * 2) / barCount)}px`,
              height: barHeight,
              backgroundColor: isActive ? color : 'rgba(128,128,128,0.2)',
              borderRadius: '2px',
              transition: 'height 0.08s ease, background-color 0.15s ease',
            }}
          />
        );
      })}
    </Box>
  );
};

export default VoiceIndicator;