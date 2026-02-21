import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, getThumbnailUrl, fetchVideoTitle } from "@/lib/youtube";
import { fetchCaptions, captionsToTranscript } from "@/lib/captions";
import { summarizeTranscript } from "@/lib/llm";
import { upsertVideo, getVideoByYoutubeId } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, prompt } = body;

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

    // Use cache only when there's no custom prompt
    if (!userPrompt) {
      const existing = getVideoByYoutubeId(videoId);
      if (existing && existing.summary_en) {
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
    }

    // Fetch captions
    const captions = await fetchCaptions(videoId);
    const transcript = captionsToTranscript(captions);

    // Summarize
    const result = await summarizeTranscript(
      transcript,
      captions.map((c) => ({ start: c.start, text: c.text })),
      userPrompt || undefined
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
