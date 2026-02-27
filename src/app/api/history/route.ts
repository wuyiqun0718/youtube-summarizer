import { NextRequest, NextResponse } from "next/server";
import { getAllVideos, getVideoByYoutubeId, getTagsForAllVideos, getTagsForVideo } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get("id");

    // Single video lookup
    if (videoId) {
      const video = getVideoByYoutubeId(videoId);
      if (!video) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }
      let captions: { start: number; dur: number; text: string }[] = [];
      try { captions = JSON.parse(video.captions_raw); } catch { /* ignore */ }
      const tags = getTagsForVideo(videoId);
      return NextResponse.json({
        video: {
          youtube_id: video.youtube_id,
          title: video.title,
          thumbnail: video.thumbnail,
          en: video.summary_en,
          zh: video.summary_zh,
          captions,
          favorited: !!video.favorited,
          tags,
        },
      });
    }

    // List all
    const videos = getAllVideos();
    const allVideoTags = getTagsForAllVideos();
    const list = videos.map((v) => ({
      id: v.id,
      youtube_id: v.youtube_id,
      title: v.title,
      thumbnail: v.thumbnail,
      favorited: !!v.favorited,
      created_at: v.created_at,
      tags: allVideoTags[v.youtube_id] || [],
    }));
    return NextResponse.json({ videos: list });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
