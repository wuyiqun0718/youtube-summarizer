import { NextRequest, NextResponse } from "next/server";
import { getAllTags, createTag, updateTag, deleteTag, getTagsForAllVideos } from "@/lib/db";

// GET /api/tags — list all tags (optionally with video counts)
export async function GET() {
  const tags = getAllTags();
  const videoTags = getTagsForAllVideos();

  // Count videos per tag
  const countMap: Record<number, number> = {};
  for (const vTags of Object.values(videoTags)) {
    for (const t of vTags) {
      countMap[t.id] = (countMap[t.id] || 0) + 1;
    }
  }

  return NextResponse.json({
    tags: tags.map(t => ({ ...t, videoCount: countMap[t.id] || 0 })),
  });
}

// POST /api/tags — create a new tag
export async function POST(request: NextRequest) {
  const { name, color } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
  }
  try {
    const tag = createTag(name.trim(), color);
    return NextResponse.json({ tag });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    }
    throw err;
  }
}

// PUT /api/tags — update a tag
export async function PUT(request: NextRequest) {
  const { id, name, color } = await request.json();
  if (!id) return NextResponse.json({ error: "Tag id required" }, { status: 400 });
  const tag = updateTag(id, { name, color });
  if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  return NextResponse.json({ tag });
}

// DELETE /api/tags — delete a tag
export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Tag id required" }, { status: 400 });
  deleteTag(id);
  return NextResponse.json({ ok: true });
}
