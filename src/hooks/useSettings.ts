import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings, Settings } from '../db';

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings | null>(null);

  const loadSettings = useCallback(async () => {
    const loadedSettings = await getSettings();
    setSettings(loadedSettings);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    await saveSettings(newSettings);
    const updatedSettings = await getSettings();
    setSettings(updatedSettings);
  };

  return { settings, updateSettings, loadSettings };
};
