import Database from '@tauri-apps/plugin-sql';

export interface Session {
  id?: number;
  start_time: number;
  end_time: number;
  duration_seconds: number;
  model: string;
  input_audio_tokens: number;
  output_audio_tokens: number;
  input_text_tokens: number;
  output_text_tokens: number;
  total_cost: number;
  mic_device?: string;
  speaker_device?: string;
  created_at?: number;
}

export interface Message {
  id?: number;
  session_id: number;
  speaker: 'You' | 'Agent';
  text: string;
  timestamp: number;
  created_at?: number;
}

// Calculate session cost based on token usage
export function calculateSessionCost(
  tokenUsage: {
    inputAudioTokens: number;
    outputAudioTokens: number;
    inputTextTokens: number;
    outputTextTokens: number;
  }
): number {
  // Pricing per million tokens for gpt-4o-realtime-preview
  const PRICE_PER_MILLION = {
    inputAudio: 100,
    outputAudio: 200,
    inputText: 2.5,
    outputText: 10,
  };

  const totalCost = 
    (tokenUsage.inputAudioTokens / 1_000_000) * PRICE_PER_MILLION.inputAudio +
    (tokenUsage.outputAudioTokens / 1_000_000) * PRICE_PER_MILLION.outputAudio +
    (tokenUsage.inputTextTokens / 1_000_000) * PRICE_PER_MILLION.inputText +
    (tokenUsage.outputTextTokens / 1_000_000) * PRICE_PER_MILLION.outputText;

  return Math.round(totalCost * 100) / 100; // Round to 2 decimal places
}

// Save a session with its messages
export async function saveSession(
  sessionData: Omit<Session, 'id' | 'created_at'>,
  messages: Omit<Message, 'id' | 'session_id' | 'created_at'>[]
): Promise<number> {
  const db = await Database.load('sqlite:nia.db');
  
  try {
    // Start transaction
    await db.execute('BEGIN TRANSACTION');
    
    // Insert session
    const sessionResult = await db.execute(
      `INSERT INTO sessions (
        start_time, end_time, duration_seconds, model,
        input_audio_tokens, output_audio_tokens, input_text_tokens, output_text_tokens,
        total_cost, mic_device, speaker_device
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionData.start_time,
        sessionData.end_time,
        sessionData.duration_seconds,
        sessionData.model,
        sessionData.input_audio_tokens,
        sessionData.output_audio_tokens,
        sessionData.input_text_tokens,
        sessionData.output_text_tokens,
        sessionData.total_cost,
        sessionData.mic_device || null,
        sessionData.speaker_device || null,
      ]
    );
    
    const sessionId = sessionResult.lastInsertId;
    
    if (!sessionId) {
      throw new Error('Failed to get session ID');
    }
    
    // Insert messages
    for (const message of messages) {
      await db.execute(
        'INSERT INTO messages (session_id, speaker, text, timestamp) VALUES (?, ?, ?, ?)',
        [sessionId, message.speaker, message.text, message.timestamp]
      );
    }
    
    // Commit transaction
    await db.execute('COMMIT');
    
    return sessionId;
  } catch (error) {
    // Rollback on error
    await db.execute('ROLLBACK');
    throw error;
  }
}

// Get all sessions with basic info
export async function getAllSessions(): Promise<Session[]> {
  const db = await Database.load('sqlite:nia.db');
  const result = await db.select<Session[]>(
    'SELECT * FROM sessions ORDER BY created_at DESC'
  );
  return result;
}

// Get a single session with all its messages
export async function getSessionWithMessages(sessionId: number): Promise<{
  session: Session;
  messages: Message[];
} | null> {
  const db = await Database.load('sqlite:nia.db');
  
  const sessionResult = await db.select<Session[]>(
    'SELECT * FROM sessions WHERE id = ?',
    [sessionId]
  );
  
  if (sessionResult.length === 0) {
    return null;
  }
  
  const messages = await db.select<Message[]>(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp',
    [sessionId]
  );
  
  return {
    session: sessionResult[0],
    messages,
  };
}

// Delete a session (messages will be cascade deleted)
export async function deleteSession(sessionId: number): Promise<void> {
  const db = await Database.load('sqlite:nia.db');
  await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

// Get session statistics
export async function getSessionStats(): Promise<{
  totalSessions: number;
  totalDuration: number;
  totalCost: number;
  averageDuration: number;
  totalMessages: number;
}> {
  const db = await Database.load('sqlite:nia.db');
  
  const stats = await db.select<any[]>(`
    SELECT 
      COUNT(*) as totalSessions,
      SUM(duration_seconds) as totalDuration,
      SUM(total_cost) as totalCost,
      AVG(duration_seconds) as averageDuration,
      (SELECT COUNT(*) FROM messages) as totalMessages
    FROM sessions
  `);
  
  return stats[0] || {
    totalSessions: 0,
    totalDuration: 0,
    totalCost: 0,
    averageDuration: 0,
    totalMessages: 0,
  };
}
