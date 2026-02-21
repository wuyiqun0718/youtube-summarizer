import { NextRequest, NextResponse } from "next/server";
import { getChatHistory, clearChatHistory } from "@/lib/db";

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }
  return NextResponse.json({ messages: getChatHistory(videoId) });
}

export async function DELETE(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }
  clearChatHistory(videoId);
  return NextResponse.json({ ok: true });
}
