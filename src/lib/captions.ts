import { execFile } from "child_process";
import path from "path";

export interface CaptionSegment {
  start: number;
  dur: number;
  text: string;
}

/**
 * Fetch captions for a YouTube video.
 * 1. Try youtube-transcript-api (Python)
 * 2. Fallback to yt-dlp + whisper transcription
 */
export async function fetchCaptions(
  videoId: string
): Promise<CaptionSegment[]> {
  // Try YouTube captions first
  try {
    const captions = await fetchYouTubeCaptions(videoId);
    if (captions.length > 0) return captions;
  } catch {
    // Fall through to whisper
  }

  // Fallback: download audio + whisper
  console.log(`No YouTube captions for ${videoId}, falling back to Whisper (this may take a few minutes)...`);
  return transcribeWithWhisper(videoId);
}

/**
 * Fetch captions for a local file using whisper.
 */
export async function fetchLocalCaptions(
  filePath: string
): Promise<CaptionSegment[]> {
  return transcribeWithWhisper(filePath);
}

function fetchYouTubeCaptions(videoId: string): Promise<CaptionSegment[]> {
  const scriptPath = path.join(process.cwd(), "scripts", "fetch_captions.py");
  return new Promise((resolve, reject) => {
    execFile("python3.12", [scriptPath, videoId], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        const errMsg = stderr?.trim() || error.message;
        reject(new Error(errMsg));
        return;
      }
      try {
        const segments: CaptionSegment[] = JSON.parse(stdout);
        resolve(Array.isArray(segments) ? segments : []);
      } catch {
        reject(new Error("Failed to parse captions"));
      }
    });
  });
}

function transcribeWithWhisper(input: string): Promise<CaptionSegment[]> {
  const scriptPath = path.join(process.cwd(), "scripts", "transcribe.sh");
  const modelPath = path.join(process.cwd(), "models", "ggml-small.bin");
  return new Promise((resolve, reject) => {
    execFile(
      scriptPath,
      [input, modelPath],
      { timeout: 600000, env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` } },
      (error, stdout, stderr) => {
        if (error) {
          console.error("Whisper error:", error.message);
          console.error("Whisper stderr:", stderr);
          reject(new Error(`Whisper transcription failed: ${stderr?.trim() || error.message}`));
          return;
        }
        const output = stdout.trim();
        if (!output) {
          console.error("Whisper: empty stdout, stderr:", stderr);
          reject(new Error("Whisper produced no output"));
          return;
        }
        try {
          const segments: CaptionSegment[] = JSON.parse(output);
          if (!Array.isArray(segments) || segments.length === 0) {
            reject(new Error("Whisper produced empty segments"));
            return;
          }
          resolve(segments);
        } catch (e) {
          console.error("Whisper parse error. stdout:", output.slice(0, 500));
          console.error("stderr:", stderr?.slice(0, 500));
          reject(new Error(`Failed to parse Whisper output: ${e instanceof Error ? e.message : String(e)}`));
        }
      }
    );
  });
}

/**
 * Combine caption segments into a single transcript string.
 */
export function captionsToTranscript(captions: CaptionSegment[]): string {
  return captions.map((c) => c.text).join(" ");
}

// formatTimestamp moved to @/lib/format.ts for client-side compatibility
