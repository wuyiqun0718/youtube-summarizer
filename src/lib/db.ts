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

    // Add prompt column (user's custom guideline)
    try { db.exec(`ALTER TABLE videos ADD COLUMN prompt TEXT NOT NULL DEFAULT ''`); } catch { /* exists */ }

    // Add chapters column (JSON array from YouTube)
    try { db.exec(`ALTER TABLE videos ADD COLUMN chapters TEXT NOT NULL DEFAULT '[]'`); } catch { /* exists */ }

    // Tags table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6B7280',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Video-Tag junction table
    db.exec(`
      CREATE TABLE IF NOT EXISTS video_tags (
        video_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (video_id, tag_id),
        FOREIGN KEY (video_id) REFERENCES videos(youtube_id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Frames table (visual key frames)
    // Migration: drop old table with analysis column if it exists
    const hasAnalysis = db.prepare(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('frames') WHERE name='analysis'"
    ).get() as { cnt: number };
    if (hasAnalysis.cnt > 0) {
      db.exec("DROP TABLE frames");
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS frames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        youtube_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(youtube_id, timestamp)
      )
    `);
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
  prompt: string;
  chapters: string;
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
  prompt?: string;
  chapters?: string;
}): VideoRow {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO videos (youtube_id, title, thumbnail, summary_en, summary_zh, captions_raw, prompt, chapters)
    VALUES (@youtube_id, @title, @thumbnail, @summary_en, @summary_zh, @captions_raw, @prompt, @chapters)
    ON CONFLICT(youtube_id) DO UPDATE SET
      title = @title,
      thumbnail = @thumbnail,
      summary_en = @summary_en,
      summary_zh = @summary_zh,
      captions_raw = @captions_raw,
      prompt = @prompt,
      chapters = @chapters,
      created_at = datetime('now')
  `);

  stmt.run({
    youtube_id: data.youtube_id,
    title: data.title,
    thumbnail: data.thumbnail,
    summary_en: data.summary_en,
    summary_zh: data.summary_zh,
    captions_raw: data.captions_raw,
    prompt: data.prompt || "",
    chapters: data.chapters || "[]",
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

// --- Frames (visual analysis) ---

export interface FrameRow {
  id: number;
  youtube_id: string;
  timestamp: number;
  image_path: string;
  created_at: string;
}

export function upsertFrames(
  videoId: string,
  frames: { timestamp: number; imagePath: string }[]
): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO frames (youtube_id, timestamp, image_path)
    VALUES (?, ?, ?)
    ON CONFLICT(youtube_id, timestamp) DO UPDATE SET
      image_path = excluded.image_path,
      created_at = datetime('now')
  `);
  const tx = db.transaction(() => {
    for (const f of frames) {
      stmt.run(videoId, f.timestamp, f.imagePath);
    }
  });
  tx();
}

export function getFramesByVideoId(videoId: string): FrameRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM frames WHERE youtube_id = ? ORDER BY timestamp")
    .all(videoId) as FrameRow[];
}

export function deleteFramesByVideoId(videoId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM frames WHERE youtube_id = ?").run(videoId);
}

// --- Tags ---

export interface TagRow {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export function getAllTags(): TagRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM tags ORDER BY name").all() as TagRow[];
}

export function createTag(name: string, color?: string): TagRow {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO tags (name, color) VALUES (?, ?)");
  const info = stmt.run(name.trim(), color || "#6B7280");
  return db.prepare("SELECT * FROM tags WHERE id = ?").get(info.lastInsertRowid) as TagRow;
}

export function updateTag(id: number, data: { name?: string; color?: string }): TagRow | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name.trim()); }
  if (data.color !== undefined) { fields.push("color = ?"); values.push(data.color); }
  if (fields.length === 0) return db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as TagRow | undefined;
  values.push(id);
  db.prepare(`UPDATE tags SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as TagRow | undefined;
}

export function deleteTag(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM tags WHERE id = ?").run(id);
}

export function getTagsForVideo(youtubeId: string): TagRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN video_tags vt ON vt.tag_id = t.id
    WHERE vt.video_id = ?
    ORDER BY t.name
  `).all(youtubeId) as TagRow[];
}

export function setVideoTags(youtubeId: string, tagIds: number[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM video_tags WHERE video_id = ?").run(youtubeId);
    const stmt = db.prepare("INSERT INTO video_tags (video_id, tag_id) VALUES (?, ?)");
    for (const tagId of tagIds) {
      stmt.run(youtubeId, tagId);
    }
  });
  tx();
}

export function getOrCreateTagByName(name: string): TagRow {
  const db = getDb();
  const trimmed = name.trim();
  const existing = db.prepare("SELECT * FROM tags WHERE name = ? COLLATE NOCASE").get(trimmed) as TagRow | undefined;
  if (existing) return existing;
  return createTag(trimmed);
}

export function getTagsForAllVideos(): Record<string, TagRow[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT vt.video_id, t.id, t.name, t.color, t.created_at
    FROM video_tags vt JOIN tags t ON vt.tag_id = t.id
    ORDER BY t.name
  `).all() as (TagRow & { video_id: string })[];
  const result: Record<string, TagRow[]> = {};
  for (const row of rows) {
    if (!result[row.video_id]) result[row.video_id] = [];
    result[row.video_id].push({ id: row.id, name: row.name, color: row.color, created_at: row.created_at });
  }
  return result;
}
