import React, { useState, useEffect } from 'react';
import { 
  TextField, 
  Select, 
  MenuItem, 
  Button, 
  Typography, 
  FormControl, 
  InputLabel,
  Stack,
  FormControlLabel,
  Switch,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
  Box,
  Chip
} from '@mui/material';
import { PlayArrow, Stop, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { useSettings } from '../hooks/useSettings';

export const Configuration: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [apiKey, setApiKey] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [prompt, setPrompt] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [model, setModel] = useState('gpt-4o-realtime-preview');
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'valid' | 'invalid' | 'unchecked'>('unchecked');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setApiKey(settings.apiKey || '');
      setVoice(settings.voice || 'alloy');
      setPrompt(settings.prompt || '');
      setDarkMode(settings.darkMode || false);
      setModel(settings.model || 'gpt-4o-realtime-preview');
      // Reset validation status when settings change
      setApiKeyStatus('unchecked');
      setValidationError(null);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      apiKey,
      voice,
      prompt,
      darkMode,
      model
    });
  };

  const validateApiKey = async () => {
    if (!apiKey) return;

    setIsValidatingKey(true);
    setValidationError(null);
    
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        setApiKeyStatus('valid');
        // Save the key immediately if it's valid
        updateSettings({ apiKey });
      } else {
        setApiKeyStatus('invalid');
        if (response.status === 401) {
          setValidationError('Invalid API key');
        } else {
          setValidationError(`API error: ${response.status}`);
        }
      }
    } catch (error) {
      setApiKeyStatus('invalid');
      setValidationError('Failed to validate API key');
    } finally {
      setIsValidatingKey(false);
    }
  };

  const testVoice = async () => {
    if (!apiKey) {
      setTestError('Please enter an API key first');
      return;
    }

    setIsTestingVoice(true);
    setTestError(null);

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      setCurrentAudio(null);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: `Hello! This is a test of the ${voice} voice. I'm your AI assistant and I'm excited to chat with you.`,
          voice: voice,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setCurrentAudio(null);
      };

      setCurrentAudio(audio);
      await audio.play();
    } catch (error) {
      console.error('Voice test error:', error);
      setTestError(error instanceof Error ? error.message : 'Failed to test voice');
    } finally {
      setIsTestingVoice(false);
    }
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      setCurrentAudio(null);
    }
  };

  return (
    <Box sx={{ 
      height: '100%',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      overflow: 'auto',
      p: 2
    }}>
      <Paper sx={{ 
        padding: 4, 
        maxWidth: '600px', 
        width: '100%',
        mx: 2,
        backgroundColor: 'background.paper' 
      }}>
        <Typography variant="h5" gutterBottom>
          Configuration
        </Typography>
        <Stack spacing={3}>
        <FormControlLabel
          control={
            <Switch
              checked={darkMode}
              onChange={(e) => {
                const newDarkMode = e.target.checked;
                setDarkMode(newDarkMode);
                // Immediately update dark mode without waiting for save button
                updateSettings({ darkMode: newDarkMode });
              }}
            />
          }
          label="Dark Mode"
        />
        <Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              id="apiKey"
              label="OpenAI API Key"
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                // Reset validation status when key changes
                setApiKeyStatus('unchecked');
                setValidationError(null);
              }}
              fullWidth
              variant="outlined"
              size="small"
              error={apiKeyStatus === 'invalid'}
              helperText={validationError}
            />
            <Button
              variant="outlined"
              onClick={validateApiKey}
              disabled={!apiKey || isValidatingKey}
              size="small"
              sx={{ minWidth: '100px' }}
            >
              {isValidatingKey ? (
                <CircularProgress size={20} />
              ) : (
                'Validate'
              )}
            </Button>
          </Stack>
          {apiKeyStatus === 'valid' && (
            <Chip
              icon={<CheckCircle />}
              label="Valid API Key"
              color="success"
              size="small"
              sx={{ mt: 1 }}
            />
          )}
          {apiKeyStatus === 'invalid' && !validationError && (
            <Chip
              icon={<ErrorIcon />}
              label="Invalid API Key"
              color="error"
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
        <Box>
          <FormControl fullWidth size="small">
            <InputLabel id="voice-label">AI Voice</InputLabel>
            <Select
              labelId="voice-label"
              id="voice"
              value={voice}
              label="AI Voice"
              onChange={(e) => setVoice(e.target.value)}
            >
              <MenuItem value="alloy">Alloy</MenuItem>
              <MenuItem value="echo">Echo</MenuItem>
              <MenuItem value="fable">Fable</MenuItem>
              <MenuItem value="onyx">Onyx</MenuItem>
              <MenuItem value="nova">Nova</MenuItem>
              <MenuItem value="shimmer">Shimmer</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={testVoice}
              disabled={isTestingVoice || !apiKey}
              startIcon={isTestingVoice ? <CircularProgress size={16} /> : <PlayArrow />}
            >
              {isTestingVoice ? 'Testing...' : 'Test Voice'}
            </Button>
            {currentAudio && (
              <IconButton
                size="small"
                onClick={stopAudio}
                color="error"
              >
                <Stop />
              </IconButton>
            )}
          </Box>
          {testError && (
            <Alert severity="error" sx={{ mt: 1 }} onClose={() => setTestError(null)}>
              {testError}
            </Alert>
          )}
        </Box>
        <FormControl fullWidth size="small">
          <InputLabel id="model-label">AI Model</InputLabel>
          <Select
            labelId="model-label"
            id="model"
            value={model}
            label="AI Model"
            onChange={(e) => setModel(e.target.value)}
          >
            <MenuItem value="gpt-4o-realtime-preview">GPT-4o Realtime (Preview)</MenuItem>
            <MenuItem value="gpt-4o-mini-realtime-preview">GPT-4o Mini Realtime (Preview)</MenuItem>
          </Select>
        </FormControl>
        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" gutterBottom>
            Pricing Information (Audio)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>GPT-4o Realtime:</strong> $40/M input tokens, $80/M output tokens
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>GPT-4o Mini Realtime:</strong> $10/M input tokens, $20/M output tokens
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Text tokens are charged separately at lower rates
          </Typography>
        </Paper>
        <TextField
          id="prompt"
          label="System Prompt"
          placeholder="Enter a custom system prompt for the AI assistant"
          multiline
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          fullWidth
          variant="outlined"
          size="small"
        />
        <Button 
          variant="contained" 
          onClick={handleSave}
          sx={{ alignSelf: 'flex-start' }}
        >
          Save Settings
        </Button>
      </Stack>
    </Paper>
    </Box>
  );
};
