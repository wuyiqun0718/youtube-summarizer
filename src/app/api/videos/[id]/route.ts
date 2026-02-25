import { NextRequest, NextResponse } from "next/server";
import { deleteVideoByYoutubeId, deleteFramesByVideoId } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Clean up frames (DB + disk)
    deleteFramesByVideoId(id);
    const framesDir = path.join(process.cwd(), "public", "frames", id);
    if (fs.existsSync(framesDir)) {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }

    deleteVideoByYoutubeId(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
