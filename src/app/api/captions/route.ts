import { NextRequest, NextResponse } from "next/server";
import { extractVideoId } from "@/lib/youtube";
import { fetchCaptions, captionsToTranscript } from "@/lib/captions";

export async function POST(request: NextRequest) {
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

    const captions = await fetchCaptions(videoId);
    const transcript = captionsToTranscript(captions);

    return NextResponse.json({
      videoId,
      captions,
      transcript,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch captions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
