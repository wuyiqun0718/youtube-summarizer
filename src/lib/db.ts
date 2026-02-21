import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "youtube-summarizer.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // New clean schema — markdown-based summaries
    db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        youtube_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        thumbnail TEXT NOT NULL DEFAULT '',
        summary_en TEXT NOT NULL DEFAULT '',
        summary_zh TEXT NOT NULL DEFAULT '',
        captions_raw TEXT NOT NULL DEFAULT '',
        favorited INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Migration: add new columns if coming from old schema
    const migrations = [
      `ALTER TABLE videos ADD COLUMN summary_en TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE videos ADD COLUMN summary_zh TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE videos ADD COLUMN favorited INTEGER NOT NULL DEFAULT 0`,
    ];
    for (const sql of migrations) {
      try { db.exec(sql); } catch { /* column already exists */ }
    }

    // Add chat_history column
    try { db.exec(`ALTER TABLE videos ADD COLUMN chat_history TEXT NOT NULL DEFAULT '[]'`); } catch { /* exists */ }
  }
  return db;
}


export interface VideoRow {
  id: number;
  youtube_id: string;
  title: string;
  thumbnail: string;
  summary_en: string;
  summary_zh: string;
  captions_raw: string;
  chat_history: string;
  favorited: number;
  created_at: string;
}

export function upsertVideo(data: {
  youtube_id: string;
  title: string;
  thumbnail: string;
  summary_en: string;
  summary_zh: string;
  captions_raw: string;
}): VideoRow {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO videos (youtube_id, title, thumbnail, summary_en, summary_zh, captions_raw)
    VALUES (@youtube_id, @title, @thumbnail, @summary_en, @summary_zh, @captions_raw)
    ON CONFLICT(youtube_id) DO UPDATE SET
      title = @title,
      thumbnail = @thumbnail,
      summary_en = @summary_en,
      summary_zh = @summary_zh,
      captions_raw = @captions_raw,
      created_at = datetime('now')
  `);

  stmt.run({
    youtube_id: data.youtube_id,
    title: data.title,
    thumbnail: data.thumbnail,
    summary_en: data.summary_en,
    summary_zh: data.summary_zh,
    captions_raw: data.captions_raw,
  });

  return getVideoByYoutubeId(data.youtube_id)!;
}

export function getVideoByYoutubeId(youtubeId: string): VideoRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM videos WHERE youtube_id = ?")
    .get(youtubeId) as VideoRow | undefined;
}

export function getAllVideos(): VideoRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM videos ORDER BY created_at DESC")
    .all() as VideoRow[];
}

export function deleteVideo(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM videos WHERE id = ?").run(id);
}

export function deleteVideoByYoutubeId(youtubeId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM videos WHERE youtube_id = ?").run(youtubeId);
}

// Chat history (stored as JSON in videos.chat_history)
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function getChatHistory(youtubeId: string): ChatMessage[] {
  const db = getDb();
  const row = db.prepare("SELECT chat_history FROM videos WHERE youtube_id = ?").get(youtubeId) as { chat_history: string } | undefined;
  if (!row) return [];
  try { return JSON.parse(row.chat_history); } catch { return []; }
}

export function saveChatHistory(youtubeId: string, messages: ChatMessage[]): void {
  const db = getDb();
  db.prepare("UPDATE videos SET chat_history = ? WHERE youtube_id = ?").run(JSON.stringify(messages), youtubeId);
}

export function clearChatHistory(youtubeId: string): void {
  const db = getDb();
  db.prepare("UPDATE videos SET chat_history = '[]' WHERE youtube_id = ?").run(youtubeId);
}

export function toggleFavorite(youtubeId: string): boolean {
  const db = getDb();
  const video = getVideoByYoutubeId(youtubeId);
  if (!video) return false;
  const newVal = video.favorited ? 0 : 1;
  db.prepare("UPDATE videos SET favorited = ? WHERE youtube_id = ?").run(newVal, youtubeId);
  return newVal === 1;
}
