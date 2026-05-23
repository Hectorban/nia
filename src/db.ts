import Database from '@tauri-apps/plugin-sql';

// This will hold our database connection.
let db: Database | null = null;

// Define the structure of our settings objects.
export interface DeviceSettings {
  selectedMicId: string | null;
  selectedSpeakerId: string | null;
}

export interface Settings {
  // ElevenLabs
  elevenlabsApiKey?: string;
  elevenlabsAgentId?: string;
  elevenlabsVoiceId?: string;
  // Devices
  selectedMicId?: string | null;
  selectedSpeakerId?: string | null;
  volume?: number;
  // App
  darkMode?: boolean;
  // Services
  firecrawlApiKey?: string;
  // Agent overrides
  prompt?: string;
  language?: string;
  // VTube Studio
  vtubeStudioAuthAccepted?: boolean;
  vtubeStudioAuthToken?: string;
}

export type RealtimeSettings = Pick<Settings,
  | 'elevenlabsApiKey'
  | 'elevenlabsAgentId'
  | 'elevenlabsVoiceId'
  | 'firecrawlApiKey'
  | 'prompt'
  | 'language'
  | 'darkMode'
>;

/**
 * Gets the database instance, creating it if it doesn't exist.
 */
async function getDB(): Promise<Database> {
  if (db) {
    return db;
  }
  // load the database
  db = await Database.load('sqlite:nia.db');
  return db;
}

/**
 * Retrieves all settings from the database.
 */
export async function getSettings(): Promise<Settings> {
  const dbInstance = await getDB();
  const result = await dbInstance.select<any[]>('SELECT key, value FROM settings');
  const settings: Settings = {};

  for (const row of result) {
    try {
      if (row.key === 'elevenlabsApiKey') settings.elevenlabsApiKey = row.value;
      else if (row.key === 'elevenlabsAgentId') settings.elevenlabsAgentId = row.value;
      else if (row.key === 'elevenlabsVoiceId') settings.elevenlabsVoiceId = row.value;
      else if (row.key === 'selectedMicId') settings.selectedMicId = row.value;
      else if (row.key === 'selectedSpeakerId') settings.selectedSpeakerId = row.value;
      else if (row.key === 'volume') settings.volume = JSON.parse(row.value);
      else if (row.key === 'darkMode') settings.darkMode = JSON.parse(row.value);
      else if (row.key === 'firecrawlApiKey') settings.firecrawlApiKey = row.value;
      else if (row.key === 'prompt') settings.prompt = row.value;
      else if (row.key === 'language') settings.language = row.value;
      else if (row.key === 'vtubeStudioAuthAccepted') settings.vtubeStudioAuthAccepted = JSON.parse(row.value);
      else if (row.key === 'vtubeStudioAuthToken') settings.vtubeStudioAuthToken = row.value;
    } catch (error) {
      console.error(`Failed to parse setting ${row.key}:`, error);
    }
  }

  return settings;
}

/**
 * Retrieves the device settings from the database.
 */
export async function getDeviceSettings(): Promise<DeviceSettings> {
  const settings = await getSettings();
  return {
    selectedMicId: settings.selectedMicId || null,
    selectedSpeakerId: settings.selectedSpeakerId || null
  };
}

/**
 * Saves a single setting to the database.
 */
export async function saveSetting(key: string, value: any) {
  const dbInstance = await getDB();
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  await dbInstance.execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    [key, stringValue, stringValue]
  );
}

/**
 * Saves multiple settings to the database.
 */
export async function saveSettings(settings: Partial<Settings>) {
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      await saveSetting(key, value);
    }
  }
}

/**
 * Saves the device settings to the database.
 */
export async function saveDeviceSettings(settings: DeviceSettings) {
  await saveSettings({
    selectedMicId: settings.selectedMicId,
    selectedSpeakerId: settings.selectedSpeakerId
  });
}

/**
 * Retrieves the realtime settings (ElevenLabs + services) from the database.
 */
export async function getRealtimeSettings(): Promise<RealtimeSettings | null> {
  const settings = await getSettings();
  if (settings.elevenlabsApiKey || settings.elevenlabsAgentId) {
    return {
      elevenlabsApiKey: settings.elevenlabsApiKey || '',
      elevenlabsAgentId: settings.elevenlabsAgentId || '',
      elevenlabsVoiceId: settings.elevenlabsVoiceId,
      firecrawlApiKey: settings.firecrawlApiKey,
      prompt: settings.prompt,
      language: settings.language || 'es',
      darkMode: settings.darkMode || false,
    };
  }
  return null;
}

/**
 * Saves the realtime settings to the database.
 */
export async function saveRealtimeSettings(settings: Partial<RealtimeSettings>) {
  await saveSettings(settings);
}

/**
 * Retrieves VTube Studio authentication settings from the database.
 */
export async function getVTubeStudioSettings(): Promise<{ authAccepted: boolean; authToken: string | null }> {
  const settings = await getSettings();
  return {
    authAccepted: settings.vtubeStudioAuthAccepted || false,
    authToken: settings.vtubeStudioAuthToken || null
  };
}

/**
 * Saves VTube Studio authentication acceptance and token to the database.
 */
export async function saveVTubeStudioAuth(authAccepted: boolean, authToken: string | null = null) {
  await saveSetting('vtubeStudioAuthAccepted', authAccepted);
  if (authToken) {
    await saveSetting('vtubeStudioAuthToken', authToken);
  }
}

/**
 * Clears VTube Studio authentication data from the database.
 */
export async function clearVTubeStudioAuth() {
  await saveSetting('vtubeStudioAuthAccepted', false);
  await saveSetting('vtubeStudioAuthToken', null);
}