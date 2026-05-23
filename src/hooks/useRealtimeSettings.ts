import { useState, useEffect, useCallback } from 'react';
import { getRealtimeSettings, saveRealtimeSettings, RealtimeSettings } from '../db';

export const useRealtimeSettings = () => {
  const [settings, setSettings] = useState<RealtimeSettings | null>(null);

  const loadSettings = useCallback(async () => {
    const loadedSettings = await getRealtimeSettings();
    setSettings(loadedSettings);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async (newSettings: RealtimeSettings) => {
    await saveRealtimeSettings(newSettings);
    setSettings(newSettings);
  };

  return { settings, saveSettings, loadSettings };
};