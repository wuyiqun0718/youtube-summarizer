/**
 * Utility functions for YouTube video processing.
 */

import path from "path";
import fs from "fs";

/**
 * Returns yt-dlp cookie arguments.
 * Prefers cookies.txt file if exists, otherwise reads from Firefox.
 */
export function ytDlpCookieArgs(): string[] {
  const cookiePath = path.join(process.cwd(), "cookies.txt");
  if (fs.existsSync(cookiePath)) {
    return ["--cookies", cookiePath];
  }
  return ["--cookies-from-browser", "firefox"];
}

/**
 * Extract video ID from various YouTube URL formats.
 */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Direct video ID (11 chars, alphanumeric + _ + -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    // youtube.com/watch?v=VIDEO_ID
    if (
      (url.hostname === "www.youtube.com" ||
        url.hostname === "youtube.com" ||
        url.hostname === "m.youtube.com") &&
      url.pathname === "/watch"
    ) {
      return url.searchParams.get("v");
    }
    // youtu.be/VIDEO_ID
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1) || null;
    }
    // youtube.com/embed/VIDEO_ID
    if (
      (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") &&
      url.pathname.startsWith("/embed/")
    ) {
      return url.pathname.split("/")[2] || null;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

/**
 * Get YouTube thumbnail URL for a video ID.
 */
export function getThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export interface Chapter {
  title: string;
  start: number;
  end: number;
}

/**
 * Fetch video chapters via yt-dlp (returns empty array if no chapters).
 */
export async function fetchChapters(videoId: string): Promise<Chapter[]> {
  const { execFile } = await import("child_process");
  const { createLogger } = await import("@/lib/logger");
  const log = createLogger("youtube");
  const timer = log.time(`fetch chapters for ${videoId}`);
  return new Promise((resolve) => {
    execFile(
      "/opt/homebrew/bin/yt-dlp",
      [
        "--dump-json",
        "--no-download",
        "--no-warnings",
        ...ytDlpCookieArgs(),
        "--proxy",
        "http://127.0.0.1:7897",
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      {
        timeout: 30000,
        env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
      },
      (error, stdout) => {
        if (error || !stdout) {
          log.warn(`yt-dlp failed or empty: ${error?.message ?? "no stdout"}`);
          timer.end("no data");
          resolve([]);
          return;
        }
        try {
          const data = JSON.parse(stdout);
          const chapters = data.chapters;
          if (!Array.isArray(chapters) || chapters.length === 0) {
            timer.end("no chapters");
            resolve([]);
            return;
          }
          const result = chapters.map((c: { title: string; start_time: number; end_time: number }) => ({
            title: c.title,
            start: c.start_time,
            end: c.end_time,
          }));
          timer.end(`${result.length} chapters`);
          resolve(result);
        } catch {
          timer.end("parse error");
          resolve([]);
        }
      }
    );
  });
}

/**
 * Fetch video title from YouTube oEmbed API (no API key needed).
 */
export async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      return data.title || `Video ${videoId}`;
    }
  } catch {
    // fallback
  }
  return `Video ${videoId}`;
}
