import { NextRequest } from "next/server";
import { getVideoByYoutubeId, getChatHistory, saveChatHistory, getFramesByVideoId } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import fs from "fs";
import path from "path";

// Ensure Next.js doesn't buffer or cache this route
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const QWEN_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_MODEL = "qwen-vl-plus"; // Vision-language model for frame-aware chat

const log = createLogger("chat");

export async function POST(req: NextRequest) {
  const totalTimer = log.time("POST /api/chat");
  try {
    const { videoId, message, includeTranscript } = (await req.json()) as {
      videoId: string;
      message: string;
      includeTranscript?: boolean;
    };

    if (!videoId || !message) {
      return Response.json(
        { error: "videoId and message are required" },
        { status: 400 }
      );
    }

    log.info(`videoId=${videoId}, includeTranscript=${!!includeTranscript}, msgLen=${message.length}`);

    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      return Response.json(
        { reply: "API key not configured. Please set QWEN_API_KEY." },
        { status: 200 }
      );
    }

    const video = getVideoByYoutubeId(videoId);
    if (!video || !video.captions_raw) {
      log.warn("video not found or no captions");
      return Response.json(
        { error: "Video not found or has no captions" },
        { status: 404 }
      );
    }

    // Load history & append user message
    const history = getChatHistory(videoId);
    log.info(`chat history: ${history.length} messages`);
    history.push({ role: "user", content: message });

    // Format captions into readable timestamped text
    let captions: { start: number; text: string }[] = [];
    try { captions = JSON.parse(video.captions_raw); } catch { /* ignore */ }

    const fmtTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    // Build context: summary (default) + optional full transcript
    const summary = video.summary_zh || video.summary_en || "";
    const transcript = includeTranscript
      ? captions
          .map(c => `[${fmtTime(c.start)}](t:${Math.round(c.start)}) ${c.text}`)
          .join("\n")
          .slice(0, 100000)
      : "";

    // Load frame images for visual context
    const frameRows = getFramesByVideoId(videoId);
    const frameImages: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    const frameTimer = log.time("load frame images");
    for (const f of frameRows) {
      const framePath = path.join(process.cwd(), "public", f.image_path);
      if (fs.existsSync(framePath)) {
        const base64 = fs.readFileSync(framePath).toString("base64");
        frameImages.push({ type: "text", text: `[${fmtTime(f.timestamp)}]` });
        frameImages.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
      }
    }
    frameTimer.end(`${frameImages.length / 2} frames loaded`);

    const contextSection = includeTranscript
      ? `## Video summary\n${summary}\n\n## Full transcript\n${transcript}`
      : `## Video summary\n${summary}`;

    const systemPrompt = `You are a helpful assistant for discussing a YouTube video titled "${video.title}".

## Your behavior
- Answer questions about the video using the summary${includeTranscript ? ", transcript," : ""} and key frame images as context.
- You can see the key frame screenshots from the video — use them to answer questions about what appears on screen.
- **CRITICAL timestamp rule**: Every time reference MUST be a Markdown link: [MM:SS](t:seconds) or [MM:SS](tv:seconds). Example: [2:15](t:135), [14:02](tv:842). NEVER write plain text like "2:15", "(7:53 - 8:47)", or "at 14:02". Always wrap in link format.
- Be helpful for both video-specific and general questions related to the topic.
- Respond in the same language as the user's message.
- Keep responses concise and useful.

${contextSection}`;

    // Build messages: system + optional frame images + chat history
    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: "system", content: systemPrompt },
    ];

    // Inject frame images as a context message
    if (frameImages.length > 0) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "以下是视频的关键帧截图，供后续对话参考：" },
          ...frameImages,
        ],
      });
      messages.push({ role: "assistant", content: "好的，我已看到这些关键帧截图，可以结合画面内容回答问题。" });
    }

    // Append chat history
    messages.push(
      ...history.map((m) => ({ role: m.role, content: m.content })),
    );

    const apiTimer = log.time("Qwen VL API streaming");
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
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("Qwen API error:", errorText);
      apiTimer.end("error");
      totalTimer.end("API error");
      return Response.json({ error: "LLM request failed" }, { status: 502 });
    }

    // Stream the response via SSE
    const encoder = new TextEncoder();
    let fullReply = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullReply += delta;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                }
              } catch {
                // skip malformed chunks
              }
            }
          }

          // Save to DB after stream completes
          history.push({ role: "assistant", content: fullReply });
          saveChatHistory(videoId, history);
          apiTimer.end(`reply ${fullReply.length} chars`);
          totalTimer.end("streamed");

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          log.error("stream error:", err);
          apiTimer.end("stream error");
          totalTimer.end("error");
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    log.error("failed:", err);
    totalTimer.end("error");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
