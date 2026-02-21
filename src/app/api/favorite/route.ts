import { NextRequest, NextResponse } from "next/server";
import { toggleFavorite } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    if (!videoId) {
      return NextResponse.json({ error: "videoId required" }, { status: 400 });
    }
    const favorited = toggleFavorite(videoId);
    return NextResponse.json({ favorited });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to toggle favorite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
