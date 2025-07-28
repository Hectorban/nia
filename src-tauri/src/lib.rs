use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: r#"
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_sessions_and_messages_tables",
            sql: r#"
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_time INTEGER NOT NULL,
                    end_time INTEGER NOT NULL,
                    duration_seconds INTEGER NOT NULL,
                    model TEXT NOT NULL,
                    input_audio_tokens INTEGER DEFAULT 0,
                    output_audio_tokens INTEGER DEFAULT 0,
                    input_text_tokens INTEGER DEFAULT 0,
                    output_text_tokens INTEGER DEFAULT 0,
                    total_cost REAL DEFAULT 0,
                    mic_device TEXT,
                    speaker_device TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    speaker TEXT NOT NULL CHECK(speaker IN ('You', 'Agent')),
                    text TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                );

                CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
                CREATE INDEX idx_messages_session_id ON messages(session_id);
                CREATE INDEX idx_messages_timestamp ON messages(session_id, timestamp);
            "#,
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:nia.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}