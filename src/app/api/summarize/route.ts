import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, getThumbnailUrl, fetchVideoTitle, fetchChapters } from "@/lib/youtube";
import { fetchCaptions, captionsToTranscript } from "@/lib/captions";
import { summarizeTranscript } from "@/lib/llm";
import { upsertVideo, getVideoByYoutubeId, deleteFramesByVideoId } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, prompt, force, allVisual } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid YouTube URL" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not extract video ID from URL" },
        { status: 400 }
      );
    }

    const userPrompt = typeof prompt === "string" ? prompt.trim() : "";

    const existing = getVideoByYoutubeId(videoId);

    // Use cache only when there's no custom prompt, not forced, and not a re-summarize
    if (!force && !userPrompt && existing && existing.summary_en) {
      let captions: { start: number; dur: number; text: string }[] = [];
      try { captions = JSON.parse(existing.captions_raw); } catch { /* ignore */ }
      return NextResponse.json({
        video: {
          youtube_id: existing.youtube_id,
          title: existing.title,
          thumbnail: existing.thumbnail,
          en: existing.summary_en,
          zh: existing.summary_zh,
          captions,
          favorited: !!existing.favorited,
        },
        cached: true,
      });
    }

    // Reuse cached captions/chapters from DB if available, otherwise fetch
    let captions: { start: number; dur: number; text: string }[];
    let chapters: { title: string; start: number; end: number }[];

    if (existing && existing.captions_raw) {
      try { captions = JSON.parse(existing.captions_raw); } catch { captions = []; }
      try { chapters = JSON.parse(existing.chapters); } catch { chapters = []; }
      // Fallback: if cached data is empty, re-fetch
      if (captions.length === 0) {
        [captions, chapters] = await Promise.all([
          fetchCaptions(videoId),
          fetchChapters(videoId),
        ]);
      }
    } else {
      [captions, chapters] = await Promise.all([
        fetchCaptions(videoId),
        fetchChapters(videoId),
      ]);
    }

    const transcript = captionsToTranscript(captions);

    // Clean up old frames before re-summarizing (new summary = new tv: markers)
    deleteFramesByVideoId(videoId);
    const framesDir = path.join(process.cwd(), "public", "frames", videoId);
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }

    // Summarize (with chapters if available)
    const result = await summarizeTranscript(
      transcript,
      captions.map((c) => ({ start: c.start, text: c.text })),
      userPrompt || undefined,
      chapters.length > 0 ? chapters : undefined,
      !!allVisual
    );

    // Store in DB (always overwrite with latest)
    const videoTitle = typeof title === "string" && title ? title : await fetchVideoTitle(videoId);
    const video = upsertVideo({
      youtube_id: videoId,
      title: videoTitle,
      thumbnail: getThumbnailUrl(videoId),
      summary_en: result.en,
      summary_zh: result.zh,
      captions_raw: JSON.stringify(captions.map(c => ({ start: c.start, dur: c.dur, text: c.text }))),
      prompt: userPrompt,
      chapters: JSON.stringify(chapters),
    });

    return NextResponse.json({
      video: {
        youtube_id: video.youtube_id,
        title: video.title,
        thumbnail: video.thumbnail,
        en: result.en,
        zh: result.zh,
        captions: captions.map(c => ({ start: c.start, dur: c.dur, text: c.text })),
        favorited: !!video.favorited,
      },
      cached: false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to summarize video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
