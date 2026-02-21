/**
 * Utility functions for YouTube video processing.
 */

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
