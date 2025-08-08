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
import { ElevenLabsService, ElevenLabsVoice } from '../services/elevenlabs';

export const Configuration: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [apiKey, setApiKey] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [prompt, setPrompt] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [model, setModel] = useState('gpt-4o-realtime-preview');
  const [firecrawlApiKey, setFirecrawlApiKey] = useState('');
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'valid' | 'invalid' | 'unchecked'>('unchecked');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [ttsProvider, setTtsProvider] = useState<'openai' | 'elevenlabs'>('openai');
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState('');
  const [elevenlabsVoices, setElevenlabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [elevenlabsService] = useState(new ElevenLabsService());
  const [language, setLanguage] = useState('es');

  useEffect(() => {
    if (settings) {
      setApiKey(settings.apiKey || '');
      setVoice(settings.voice || 'alloy');
      setPrompt(settings.prompt || '');
      setDarkMode(settings.darkMode || false);
      setModel(settings.model || 'gpt-4o-realtime-preview');
      setFirecrawlApiKey(settings.firecrawlApiKey || '');
      setElevenlabsApiKey(settings.elevenlabsApiKey || '');
      setTtsProvider(settings.ttsProvider || 'openai');
      setElevenlabsVoiceId(settings.elevenlabsVoiceId || '');
      setLanguage(settings.language || 'es');
      // Reset validation status when settings change
      setApiKeyStatus('unchecked');
      setValidationError(null);
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings({ 
      apiKey, 
      voice, 
      prompt, 
      darkMode, 
      model, 
      firecrawlApiKey,
      elevenlabsApiKey,
      ttsProvider,
      elevenlabsVoiceId,
      language
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

  const loadElevenlabsVoices = async () => {
    console.log('Loading ElevenLabs voices, API key present:', !!elevenlabsApiKey);
    
    if (!elevenlabsApiKey) {
      console.log('No API key, clearing voices');
      setElevenlabsVoices([]);
      return;
    }

    setIsLoadingVoices(true);
    try {
      elevenlabsService.setApiKey(elevenlabsApiKey);
      console.log('ElevenLabs service API key set, fetching voices...');
      const voices = await elevenlabsService.getVoices();
      console.log('Loaded voices:', voices.length, voices.map(v => ({ id: v.voice_id, name: v.name })));
      setElevenlabsVoices(voices);
    } catch (error) {
      console.error('Failed to load ElevenLabs voices:', error);
      setElevenlabsVoices([]);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const testElevenlabsVoice = async () => {
    console.log('Testing ElevenLabs voice:', {
      apiKey: elevenlabsApiKey ? 'Set' : 'Not set',
      voiceId: elevenlabsVoiceId,
      voicesAvailable: elevenlabsVoices.length
    });
    
    if (!elevenlabsApiKey || !elevenlabsVoiceId) {
      const errorMsg = 'Please enter ElevenLabs API key and select a voice first';
      console.log('Test failed:', errorMsg);
      setTestError(errorMsg);
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
      elevenlabsService.setApiKey(elevenlabsApiKey);
      const selectedVoice = elevenlabsVoices.find(v => v.voice_id === elevenlabsVoiceId);
      const testText = language === 'es' 
        ? `¡Hola! Esta es una prueba de la voz ${selectedVoice?.name || 'seleccionada'}. Soy tu asistente de IA y estoy emocionado de chatear contigo.`
        : `Hello! This is a test of the ${selectedVoice?.name || 'selected'} voice. I'm your AI assistant and I'm excited to chat with you.`;
      
      const audio = await elevenlabsService.playText(testText, elevenlabsVoiceId, undefined, {
        language: language
      });
      setCurrentAudio(audio);
    } catch (error) {
      console.error('Failed to test ElevenLabs voice:', error);
      setTestError(`Failed to test voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingVoice(false);
    }
  };

  // Load ElevenLabs voices when API key changes
  useEffect(() => {
    if (elevenlabsApiKey) {
      loadElevenlabsVoices();
    } else {
      setElevenlabsVoices([]);
    }
  }, [elevenlabsApiKey]);

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
        <TextField
          id="firecrawlApiKey"
          label="Firecrawl API Key (Optional)"
          type="password"
          value={firecrawlApiKey}
          onChange={(e) => setFirecrawlApiKey(e.target.value)}
          fullWidth
          variant="outlined"
          size="small"
          helperText="Required for AI to read web links. Get your API key from firecrawl.dev"
        />
        
        {/* TTS Provider Selection */}
        <FormControl fullWidth size="small">
          <InputLabel id="tts-provider-label">Text-to-Speech Provider</InputLabel>
          <Select
            labelId="tts-provider-label"
            id="tts-provider"
            value={ttsProvider}
            label="Text-to-Speech Provider"
            onChange={(e) => setTtsProvider(e.target.value as 'openai' | 'elevenlabs')}
          >
            <MenuItem value="openai">OpenAI TTS</MenuItem>
            <MenuItem value="elevenlabs">ElevenLabs TTS</MenuItem>
          </Select>
        </FormControl>

        {/* Language Selection */}
        {ttsProvider === 'elevenlabs' && (
          <FormControl fullWidth size="small">
            <InputLabel id="language-label">Language</InputLabel>
            <Select
              labelId="language-label"
              id="language"
              value={language}
              label="Language"
              onChange={(e) => setLanguage(e.target.value)}
            >
              <MenuItem value="es">Spanish (Español)</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="fr">French (Français)</MenuItem>
              <MenuItem value="de">German (Deutsch)</MenuItem>
              <MenuItem value="it">Italian (Italiano)</MenuItem>
              <MenuItem value="pt">Portuguese (Português)</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* ElevenLabs API Key */}
        {ttsProvider === 'elevenlabs' && (
          <TextField
            id="elevenlabsApiKey"
            label="ElevenLabs API Key"
            type="password"
            value={elevenlabsApiKey}
            onChange={(e) => setElevenlabsApiKey(e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Required for ElevenLabs TTS. Get your API key from elevenlabs.io"
          />
        )}

        <Box>
          <FormControl fullWidth size="small">
            <InputLabel id="voice-label">
              {ttsProvider === 'elevenlabs' ? 'ElevenLabs Voice' : 'OpenAI Voice'}
            </InputLabel>
            <Select
              labelId="voice-label"
              id="voice"
              value={ttsProvider === 'elevenlabs' ? (elevenlabsVoiceId || '') : (voice || '')}
              label={ttsProvider === 'elevenlabs' ? 'ElevenLabs Voice' : 'OpenAI Voice'}
              onChange={(e) => {
                console.log('Voice selection changed:', {
                  provider: ttsProvider,
                  newValue: e.target.value,
                  currentElevenlabsVoiceId: elevenlabsVoiceId,
                  currentVoice: voice
                });
                if (ttsProvider === 'elevenlabs') {
                  setElevenlabsVoiceId(e.target.value);
                  console.log('Set ElevenLabs voice ID to:', e.target.value);
                } else {
                  setVoice(e.target.value);
                  console.log('Set OpenAI voice to:', e.target.value);
                }
              }}
              disabled={ttsProvider === 'elevenlabs' && isLoadingVoices}
            >
              {ttsProvider === 'elevenlabs' ? (
                isLoadingVoices ? (
                  <MenuItem key="loading" disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading voices...
                  </MenuItem>
                ) : elevenlabsVoices.length > 0 ? (
                  elevenlabsVoices.map((voice) => (
                    <MenuItem key={voice.voice_id} value={voice.voice_id}>
                      {voice.name} ({voice.category})
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem key="no-voices" disabled>
                    {elevenlabsApiKey ? 'No voices available' : 'Enter API key to load voices'}
                  </MenuItem>
                )
              ) : (
                <>
                  <MenuItem key="alloy" value="alloy">Alloy</MenuItem>
                  <MenuItem key="echo" value="echo">Echo</MenuItem>
                  <MenuItem key="fable" value="fable">Fable</MenuItem>
                  <MenuItem key="onyx" value="onyx">Onyx</MenuItem>
                  <MenuItem key="nova" value="nova">Nova</MenuItem>
                  <MenuItem key="shimmer" value="shimmer">Shimmer</MenuItem>
                </>
              )}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={ttsProvider === 'elevenlabs' ? testElevenlabsVoice : testVoice}
              disabled={
                isTestingVoice || 
                (ttsProvider === 'openai' && !apiKey) || 
                (ttsProvider === 'elevenlabs' && (!elevenlabsApiKey || !elevenlabsVoiceId))
              }
              startIcon={isTestingVoice ? <CircularProgress size={16} /> : <PlayArrow />}
            >
              {isTestingVoice ? 'Testing...' : `Test ${ttsProvider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'} Voice`}
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
