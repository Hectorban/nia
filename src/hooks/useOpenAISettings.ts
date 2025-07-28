import { useState, useEffect, useCallback } from 'react';
import { getOpenAISettings, saveOpenAISettings, OpenAISettings } from '../db';

export const useOpenAISettings = () => {
  const [settings, setSettings] = useState<OpenAISettings | null>(null);

  const loadSettings = useCallback(async () => {
    const loadedSettings = await getOpenAISettings();
    setSettings(loadedSettings);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (newSettings: OpenAISettings) => {
    await saveOpenAISettings(newSettings);
    setSettings(newSettings);
  };

  return { settings, saveSettings, loadSettings };
};
