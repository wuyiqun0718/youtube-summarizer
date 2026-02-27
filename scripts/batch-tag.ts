/**
 * Batch-tag existing videos using LLM.
 * Usage: cd youtube-summarizer && npx tsx scripts/batch-tag.ts
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Load .env.local manually
const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
for (const line of envFile.split("\n")) { const [k,...v] = line.split("="); if (k && v.length) process.env[k.trim()] = v.join("=").trim(); }

const DB_PATH = path.join(process.cwd(), "data", "youtube-summarizer.db");
const QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_MODEL = "qwen-plus";
const API_KEY = process.env.QWEN_API_KEY;

if (!API_KEY) {
  console.error("QWEN_API_KEY not set.");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

interface TagRow { id: number; name: string; }

function getAllTagNames(): string[] {
  return (db.prepare("SELECT name FROM tags ORDER BY name").all() as { name: string }[]).map(t => t.name);
}

function getOrCreateTag(name: string): TagRow {
  const trimmed = name.trim();
  const existing = db.prepare("SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE").get(trimmed) as TagRow | undefined;
  if (existing) return existing;
  const info = db.prepare("INSERT INTO tags (name) VALUES (?)").run(trimmed);
  return { id: Number(info.lastInsertRowid), name: trimmed };
}

function setVideoTags(youtubeId: string, tagIds: number[]): void {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM video_tags WHERE video_id = ?").run(youtubeId);
    const stmt = db.prepare("INSERT INTO video_tags (video_id, tag_id) VALUES (?, ?)");
    for (const id of tagIds) stmt.run(youtubeId, id);
  });
  tx();
}

async function tagVideo(title: string, summary: string, existingTagNames: string[]): Promise<string[]> {
  const res = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        {
          role: "system",
          content: `你是一个视频分类助手。根据视频标题和摘要，给视频打 1-4 个标签。

现有标签：${existingTagNames.length > 0 ? existingTagNames.join("、") : "（暂无）"}

规则：
- 优先使用现有标签
- 如果没有合适的，可以创建新的简短标签
- 标签要简洁有意义
- 返回 JSON：{"tags": ["标签1", "标签2"]}`
        },
        { role: "user", content: `标题：${title}\n\n摘要：${summary.slice(0, 800)}` }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.tags) ? parsed.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : [];
  } catch { return []; }
}

async function main() {
  const videos = db.prepare(`
    SELECT v.youtube_id, v.title, v.summary_en, v.summary_zh
    FROM videos v
    WHERE NOT EXISTS (SELECT 1 FROM video_tags vt WHERE vt.video_id = v.youtube_id)
    ORDER BY v.created_at
  `).all() as { youtube_id: string; title: string; summary_en: string; summary_zh: string }[];

  console.log(`Found ${videos.length} untagged videos\n`);
  if (videos.length === 0) { console.log("All videos already have tags!"); return; }

  for (const v of videos) {
    const tagNames = getAllTagNames();
    process.stdout.write(`📹 ${v.title.slice(0, 60).padEnd(60)} `);
    try {
      const tags = await tagVideo(v.title, v.summary_zh || v.summary_en || "", tagNames);
      const tagRows = tags.map(n => getOrCreateTag(n));
      setVideoTags(v.youtube_id, tagRows.map(t => t.id));
      console.log(`→ [${tags.join(", ")}]`);
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : "failed"}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log("\n✅ Done!");
}

main().catch(console.error).finally(() => db.close());
