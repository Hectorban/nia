import Database from '@tauri-apps/plugin-sql';

// This will hold our database connection.
let db: Database | null = null;

// Define the structure of our settings objects.
export interface DeviceSettings {
  selectedMicId: string | null;
  selectedSpeakerId: string | null;
}

export interface Settings {
  apiKey?: string;
  voice?: string;
  prompt?: string;
  selectedMicId?: string | null;
  selectedSpeakerId?: string | null;
  darkMode?: boolean;
  model?: string;
}

export type OpenAISettings = Pick<Settings, 'apiKey' | 'voice' | 'prompt' | 'darkMode' | 'model'>;

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
      if (row.key === 'apiKey') settings.apiKey = row.value;
      else if (row.key === 'voice') settings.voice = row.value;
      else if (row.key === 'prompt') settings.prompt = row.value;
      else if (row.key === 'selectedMicId') settings.selectedMicId = row.value;
      else if (row.key === 'selectedSpeakerId') settings.selectedSpeakerId = row.value;
      else if (row.key === 'darkMode') settings.darkMode = JSON.parse(row.value);
      else if (row.key === 'model') settings.model = row.value;
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
 * Retrieves the OpenAI settings from the database.
 */
export async function getOpenAISettings(): Promise<OpenAISettings | null> {
  const settings = await getSettings();
  if (settings.apiKey || settings.voice || settings.prompt || settings.model) {
    return {
      apiKey: settings.apiKey || '',
      voice: settings.voice || 'alloy',
      prompt: settings.prompt,
      darkMode: settings.darkMode || false,
      model: settings.model || 'gpt-4o-realtime-preview'
    };
  }
  return null;
}

/**
 * Saves the OpenAI settings to the database.
 */
export async function saveOpenAISettings(settings: Partial<OpenAISettings>) {
  await saveSettings(settings);
}
