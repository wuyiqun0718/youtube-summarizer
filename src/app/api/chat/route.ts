import { NextRequest, NextResponse } from "next/server";
import { getVideoByYoutubeId } from "@/lib/db";

const QWEN_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_MODEL = "qwen3.5-plus";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { videoId, message, history = [] } = (await req.json()) as {
      videoId: string;
      message: string;
      history: ChatMessage[];
    };

    if (!videoId || !message) {
      return NextResponse.json(
        { error: "videoId and message are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { reply: "API key not configured. Please set QWEN_API_KEY." },
        { status: 200 }
      );
    }

    const video = getVideoByYoutubeId(videoId);
    if (!video || !video.captions_raw) {
      return NextResponse.json(
        { error: "Video not found or has no captions" },
        { status: 404 }
      );
    }

    const transcript = video.captions_raw.slice(0, 12000);

    const systemPrompt = `You are a helpful assistant for discussing a YouTube video. Below is the video transcript.

## Your behavior
- Answer questions about the video using the transcript as context.
- When referencing specific moments, embed timestamps as [MM:SS](t:seconds), e.g. [2:15](t:135).
- Be helpful for both video-specific and general questions related to the topic.
- Respond in the same language as the user's message.
- Keep responses concise and useful.

## Video transcript
${transcript}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message },
    ];

    const response = await fetch(QWEN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Qwen API error:", errorText);
      return NextResponse.json(
        { error: "LLM request failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
