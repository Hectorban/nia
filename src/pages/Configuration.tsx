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
  CircularProgress,
  Box,
} from '@mui/material';
import { PlayArrow, Stop } from '@mui/icons-material';
import { useSettings } from '../hooks/useSettings';
import { ElevenLabsService, ElevenLabsVoice } from '../services/elevenlabs';

export const Configuration: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [elevenlabsAgentId, setElevenlabsAgentId] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [firecrawlApiKey, setFirecrawlApiKey] = useState('');
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState('');
  const [elevenlabsVoices, setElevenlabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [elevenlabsService] = useState(new ElevenLabsService());
  const [language, setLanguage] = useState('es');
  const [prompt, setPrompt] = useState('');
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (settings) {
      setElevenlabsApiKey(settings.elevenlabsApiKey || '');
      setElevenlabsAgentId(settings.elevenlabsAgentId || '');
      setDarkMode(settings.darkMode || false);
      setFirecrawlApiKey(settings.firecrawlApiKey || '');
      setElevenlabsVoiceId(settings.elevenlabsVoiceId || '');
      setLanguage(settings.language || 'es');
      setPrompt(settings.prompt || '');
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings({ 
      elevenlabsApiKey,
      elevenlabsAgentId,
      darkMode,
      firecrawlApiKey,
      elevenlabsVoiceId,
      language,
      prompt,
    });
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

  const testVoice = async () => {
    if (!elevenlabsApiKey || !elevenlabsVoiceId) {
      setTestError('Please enter ElevenLabs API key and select a voice first');
      return;
    }

    setIsTestingVoice(true);
    setTestError(null);

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      setCurrentAudio(null);
    }

    try {
      elevenlabsService.setApiKey(elevenlabsApiKey);
      const selectedVoice = elevenlabsVoices.find(v => v.voice_id === elevenlabsVoiceId);
      const testText = language === 'es'
        ? `¡Hola! Esta es una prueba de la voz ${selectedVoice?.name || 'seleccionada'}.`
        : `Hello! This is a test of the ${selectedVoice?.name || 'selected'} voice.`;

      const audio = await elevenlabsService.playText(testText, elevenlabsVoiceId, undefined, {
        language: language,
      });
      setCurrentAudio(audio);
    } catch (error) {
      console.error('Failed to test voice:', error);
      setTestError(`Failed to test voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Load ElevenLabs voices when API key changes
  useEffect(() => {
    if (elevenlabsApiKey) {
      loadElevenlabsVoices();
    } else {
      setElevenlabsVoices([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                  updateSettings({ darkMode: newDarkMode });
                }}
              />
            }
            label="Dark Mode"
          />

          {/* ElevenLabs API Key */}
          <TextField
            id="elevenlabsApiKey"
            label="ElevenLabs API Key"
            type="password"
            value={elevenlabsApiKey}
            onChange={(e) => setElevenlabsApiKey(e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Required for voice conversations. Get your key from elevenlabs.io"
          />

          {/* Agent ID */}
          <TextField
            id="elevenlabsAgentId"
            label="ElevenLabs Agent ID"
            value={elevenlabsAgentId}
            onChange={(e) => setElevenlabsAgentId(e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Find this in your agent dashboard on elevenlabs.io"
          />

          {/* Language Selection */}
          <FormControl fullWidth size="small">
            <InputLabel id="language-label">Conversation Language</InputLabel>
            <Select
              labelId="language-label"
              id="language"
              value={language}
              label="Conversation Language"
              onChange={(e) => setLanguage(e.target.value)}
            >
              <MenuItem value="es">Spanish (Español)</MenuItem>
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="fr">French (Français)</MenuItem>
              <MenuItem value="de">German (Deutsch)</MenuItem>
              <MenuItem value="it">Italian (Italiano)</MenuItem>
              <MenuItem value="pt">Portuguese (Português)</MenuItem>
              <MenuItem value="ja">Japanese (日本語)</MenuItem>
              <MenuItem value="ko">Korean (한국어)</MenuItem>
              <MenuItem value="zh">Chinese (中文)</MenuItem>
            </Select>
          </FormControl>

          {/* Voice Selection (optional override) */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Voice Override (optional — leave empty to use the agent's default)
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel id="voice-label">ElevenLabs Voice</InputLabel>
              <Select
                labelId="voice-label"
                id="voice"
                value={elevenlabsVoiceId || ''}
                label="ElevenLabs Voice"
                onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                disabled={isLoadingVoices}
              >
                <MenuItem value="">
                  <em>Use agent default</em>
                </MenuItem>
                {isLoadingVoices ? (
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
                )}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={testVoice}
                disabled={isTestingVoice || !elevenlabsApiKey || !elevenlabsVoiceId}
                startIcon={isTestingVoice ? <CircularProgress size={16} /> : <PlayArrow />}
              >
                {isTestingVoice ? 'Testing...' : 'Test Voice'}
              </Button>
              {currentAudio && (
                <Button
                  size="small"
                  onClick={stopAudio}
                  color="error"
                  startIcon={<Stop />}
                >
                  Stop
                </Button>
              )}
            </Box>
            {testError && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {testError}
              </Typography>
            )}
          </Box>

          {/* Firecrawl API Key */}
          <TextField
            id="firecrawlApiKey"
            label="Firecrawl API Key (Optional)"
            type="password"
            value={firecrawlApiKey}
            onChange={(e) => setFirecrawlApiKey(e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Required for AI to read web links. Get your key from firecrawl.dev"
          />

          {/* System Prompt */}
          <TextField
            id="prompt"
            label="System Prompt Override (Optional)"
            placeholder="Leave empty to use the agent's configured prompt"
            multiline
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            helperText="Overrides the agent's default system prompt when set"
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