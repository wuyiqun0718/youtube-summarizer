import { NextRequest, NextResponse } from "next/server";
import {
  getVideoByYoutubeId,
  getFramesByVideoId,
  upsertFrames,
} from "@/lib/db";
import { processVideoFrames } from "@/lib/frames";
import { createLogger } from "@/lib/logger";

const log = createLogger("frames");

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }

  const frames = getFramesByVideoId(videoId);
  log.info(`GET videoId=${videoId}, ${frames.length} frames`);
  return NextResponse.json({
    frames: frames.map((f) => ({
      timestamp: f.timestamp,
      imagePath: f.image_path,
    })),
  });
}

export async function POST(req: NextRequest) {
  const totalTimer = log.time("POST /api/frames");
  try {
    const { videoId, allTimestamps } = await req.json();
    if (!videoId) {
      return NextResponse.json(
        { error: "videoId required" },
        { status: 400 }
      );
    }

    log.info(`videoId=${videoId}`);

    // Return cached frames if they exist
    const existing = getFramesByVideoId(videoId);
    if (existing.length > 0) {
      log.info(`cache hit: ${existing.length} frames`);
      totalTimer.end("cached");
      return NextResponse.json({
        frames: existing.map((f) => ({
          timestamp: f.timestamp,
          imagePath: f.image_path,
        })),
        cached: true,
      });
    }

    // Get video data
    const video = getVideoByYoutubeId(videoId);
    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    const summary = video.summary_zh || video.summary_en;
    if (!summary) {
      return NextResponse.json(
        { error: "No summary available" },
        { status: 400 }
      );
    }

    // Process frames (download → extract → analyze)
    const processTimer = log.time("process video frames");
    const frames = await processVideoFrames(videoId, video.title, summary);
    processTimer.end(`${frames.length} frames extracted`);

    // Store in DB
    if (frames.length > 0) {
      upsertFrames(videoId, frames);
      log.info(`saved ${frames.length} frames to DB`);
    }

    totalTimer.end(`${frames.length} frames`);
    return NextResponse.json({ frames, cached: false });
  } catch (err) {
    log.error("failed:", err);
    totalTimer.end("error");
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Frame processing failed",
      },
      { status: 500 }
    );
  }
}
