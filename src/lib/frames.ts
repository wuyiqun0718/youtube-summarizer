/**
 * Video frame extraction and visual analysis using Qwen-VL.
 *
 * Flow:
 * 1. Parse timestamps from summary markdown
 * 2. Download video via yt-dlp
 * 3. Extract frames at key timestamps via ffmpeg
 * 4. Analyze each frame with Qwen-VL
 * 5. Store results for hover preview + chat context
 */

import { execFile } from "child_process";
import path from "path";
import fs from "fs";

const MAX_FRAMES = 15;
const DEDUP_THRESHOLD = 5; // seconds

export interface FrameData {
  timestamp: number;
  imagePath: string;
}

/**
 * Parse [MM:SS](tv:seconds) visual timestamp links from markdown.
 * Only extracts timestamps marked with tv: prefix.
 */
export function extractTimestampsFromMarkdown(markdown: string): number[] {
  const regex = /\[[\d:]+\]\(tv:(\d+)\)/g;
  const seen = new Set<number>();
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    seen.add(parseInt(match[1], 10));
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Remove timestamps that are too close together.
 */
function deduplicateTimestamps(
  timestamps: number[],
  threshold: number
): number[] {
  if (timestamps.length === 0) return [];
  const result = [timestamps[0]];
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] - result[result.length - 1] >= threshold) {
      result.push(timestamps[i]);
    }
  }
  return result;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Get direct video stream URL via yt-dlp -g (no download).
 */
function getVideoUrl(videoId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "/opt/homebrew/bin/yt-dlp",
      [
        "-g",
        "-f",
        "bv*[height<=480][ext=mp4]/bv*[height<=480]/bv*/b",
        "--no-playlist",
        "--proxy",
        "http://127.0.0.1:7897",
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      {
        timeout: 30000,
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:${process.env.PATH}`,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error("yt-dlp stderr:", stderr);
          reject(new Error(`Failed to get video URL: ${error.message}`));
          return;
        }
        const url = stdout.trim().split("\n")[0];
        if (!url) {
          reject(new Error("yt-dlp returned empty URL"));
          return;
        }
        resolve(url);
      }
    );
  });
}

/**
 * Extract a single frame from a remote URL with ffmpeg.
 * -ss before -i enables fast seeking without downloading the full file.
 */
function extractFrameFromUrl(
  videoUrl: string,
  timestamp: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "/opt/homebrew/bin/ffmpeg",
      [
        "-ss",
        String(timestamp),
        "-i",
        videoUrl,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-y",
        outputPath,
      ],
      {
        timeout: 60000,
        env: {
          ...process.env,
          http_proxy: "http://127.0.0.1:7897",
          https_proxy: "http://127.0.0.1:7897",
        },
      },
      (error) => {
        if (error)
          reject(
            new Error(`ffmpeg frame @${timestamp}s: ${error.message}`)
          );
        else resolve();
      }
    );
  });
}

/**
 * Main entry: extract frames for a video (no VL pre-analysis).
 * VL analysis happens on-demand during chat.
 */
export async function processVideoFrames(
  videoId: string,
  _videoTitle: string,
  summaryMarkdown: string
): Promise<FrameData[]> {
  // 1. Parse & deduplicate timestamps
  const raw = extractTimestampsFromMarkdown(summaryMarkdown);
  if (raw.length === 0) return [];
  const timestamps = deduplicateTimestamps(raw, DEDUP_THRESHOLD).slice(
    0,
    MAX_FRAMES
  );

  // 2. Prepare output dir
  const framesDir = path.join(process.cwd(), "public", "frames", videoId);
  fs.mkdirSync(framesDir, { recursive: true });

  // 3. Get direct video URL (no full download)
  const videoUrl = await getVideoUrl(videoId);

  // 4. Extract frames directly from URL
  const frames: { timestamp: number; filePath: string }[] = [];
  for (const ts of timestamps) {
    const out = path.join(framesDir, `${ts}.jpg`);
    try {
      await extractFrameFromUrl(videoUrl, ts, out);
      frames.push({ timestamp: ts, filePath: out });
    } catch (err) {
      console.error(err);
    }
  }

  if (frames.length === 0) return [];

  // 5. Build results
  return frames.map((f) => ({
    timestamp: f.timestamp,
    imagePath: `/frames/${videoId}/${f.timestamp}.jpg`,
  }));
}
