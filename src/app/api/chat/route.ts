import { NextRequest } from "next/server";
import { getVideoByYoutubeId, getChatHistory, saveChatHistory } from "@/lib/db";

const QWEN_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_MODEL = "qwen3.5-plus";

export async function POST(req: NextRequest) {
  try {
    const { videoId, message } = (await req.json()) as {
      videoId: string;
      message: string;
    };

    if (!videoId || !message) {
      return Response.json(
        { error: "videoId and message are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      return Response.json(
        { reply: "API key not configured. Please set QWEN_API_KEY." },
        { status: 200 }
      );
    }

    const video = getVideoByYoutubeId(videoId);
    if (!video || !video.captions_raw) {
      return Response.json(
        { error: "Video not found or has no captions" },
        { status: 404 }
      );
    }

    // Load history & append user message
    const history = getChatHistory(videoId);
    history.push({ role: "user", content: message });

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
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
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
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Qwen API error:", errorText);
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

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
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
    console.error("Chat API error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
