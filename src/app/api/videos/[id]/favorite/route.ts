import { NextRequest, NextResponse } from "next/server";
import { toggleFavorite } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const favorited = toggleFavorite(id);
    return NextResponse.json({ ok: true, favorited });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to toggle favorite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
