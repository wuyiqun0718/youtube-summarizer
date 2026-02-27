import { NextRequest, NextResponse } from "next/server";
import { extractVideoId } from "@/lib/youtube";
import { fetchCaptions, captionsToTranscript } from "@/lib/captions";
import { createLogger } from "@/lib/logger";

const log = createLogger("captions");

export async function POST(request: NextRequest) {
  const totalTimer = log.time("POST /api/captions");
  try {
    const body = await request.json();
    const { url } = body;

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

    log.info(`videoId=${videoId}`);
    const captions = await fetchCaptions(videoId);
    const transcript = captionsToTranscript(captions);
    log.info(`${captions.length} segments, transcript ${transcript.length} chars`);

    totalTimer.end(`${captions.length} segments`);
    return NextResponse.json({
      videoId,
      captions,
      transcript,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch captions";
    log.error("failed:", message);
    totalTimer.end("error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
