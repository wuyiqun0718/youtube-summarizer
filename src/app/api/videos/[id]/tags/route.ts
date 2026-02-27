import { NextRequest, NextResponse } from "next/server";
import { setVideoTags, getTagsForVideo } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tags = getTagsForVideo(id);
  return NextResponse.json({ tags });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { tagIds } = await request.json();
  if (!Array.isArray(tagIds)) {
    return NextResponse.json({ error: "tagIds must be an array" }, { status: 400 });
  }
  setVideoTags(id, tagIds);
  const tags = getTagsForVideo(id);
  return NextResponse.json({ tags });
}
