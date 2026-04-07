/**
 * External tool paths and proxy configuration.
 * All values can be overridden via environment variables.
 * Defaults are platform-aware (macOS homebrew vs Windows/Linux PATH).
 */

import path from "path";
import fs from "fs";

const isMac = process.platform === "darwin";

/** Extra PATH prefix for finding tools (macOS homebrew) */
export const EXTRA_PATH = process.env.EXTRA_PATH
  || (isMac ? "/opt/homebrew/bin" : "");

/** Build PATH env with extra prefix */
export function buildPath(): string {
  return EXTRA_PATH ? `${EXTRA_PATH}${path.delimiter}${process.env.PATH}` : process.env.PATH || "";
}

/** Build env object with extended PATH */
export function buildEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  return { ...process.env, PATH: buildPath(), ...extra };
}

// Tool binaries — on macOS default to homebrew paths, otherwise rely on PATH
export const BIN_YTDLP = process.env.BIN_YTDLP
  || (isMac ? "/opt/homebrew/bin/yt-dlp" : "yt-dlp");

export const BIN_FFMPEG = process.env.BIN_FFMPEG
  || (isMac ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg");

export const BIN_PYTHON = process.env.BIN_PYTHON
  || (isMac ? "python3.12" : "python3");

export const BIN_WHISPER = process.env.BIN_WHISPER
  || (isMac ? "whisper-cli" : "whisper-cli");

/** HTTP proxy for yt-dlp / ffmpeg (empty string = no proxy) */
export const PROXY_URL = process.env.PROXY_URL || "http://127.0.0.1:7897";

/** Returns yt-dlp proxy args (empty array if no proxy) */
export function ytDlpProxyArgs(): string[] {
  return PROXY_URL ? ["--proxy", PROXY_URL] : [];
}

/** Returns yt-dlp cookie args. Prefers cookies.txt, then Firefox. */
export function ytDlpCookieArgs(): string[] {
  const cookiePath = path.join(process.cwd(), "cookies.txt");
  if (fs.existsSync(cookiePath)) {
    return ["--cookies", cookiePath];
  }
  return ["--cookies-from-browser", "firefox"];
}

/** Returns proxy env vars for ffmpeg etc. (empty object if no proxy) */
export function proxyEnv(): Record<string, string> {
  if (!PROXY_URL) return {};
  return { http_proxy: PROXY_URL, https_proxy: PROXY_URL };
}
