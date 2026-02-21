/**
 * Qwen (通义千问) LLM service for summarization.
 * Uses OpenAI-compatible API format via DashScope.
 *
 * Returns free-form Markdown — the model decides structure based on content.
 * Timestamps are embedded as [MM:SS](t:<seconds>) links.
 */

const QWEN_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const QWEN_MODEL = "qwen3.5-plus";

export interface SummaryResult {
  en: string; // Markdown
  zh: string; // Markdown
}

/**
 * Detect if transcript is primarily Chinese.
 */
function isChinese(text: string): boolean {
  const sample = text.slice(0, 2000);
  const chineseChars = (sample.match(/[\u4e00-\u9fff]/g) || []).length;
  return chineseChars / sample.length > 0.15;
}

/**
 * Format seconds → MM:SS or H:MM:SS
 */
function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
    : `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Build a condensed timeline string from caption segments so the model
 * knows which timestamps are available.
 */
function buildTimelineHint(
  segments: { start: number; text: string }[]
): string {
  // Sample ~20 evenly spaced segments
  const total = segments.length;
  const step = Math.max(1, Math.floor(total / 20));
  const samples: string[] = [];
  for (let i = 0; i < total; i += step) {
    const seg = segments[i];
    samples.push(`[${fmtTime(seg.start)}](t:${Math.round(seg.start)})`);
  }
  return samples.join(" · ");
}

/**
 * Summarize a video transcript using Qwen LLM.
 * Returns { en, zh } with Markdown content.
 */
export async function summarizeTranscript(
  transcript: string,
  captionSegments: { start: number; text: string }[],
  userPrompt?: string
): Promise<SummaryResult> {
  const apiKey = process.env.QWEN_API_KEY;

  if (!apiKey) {
    console.warn("QWEN_API_KEY not set — using placeholder.");
    return placeholderSummarize(transcript);
  }

  const chinese = isChinese(transcript);
  const timeline = buildTimelineHint(captionSegments);

  const userInstruction = userPrompt
    ? `\n\nThe user has an additional request for this summary:\n"${userPrompt}"\nPlease incorporate this into your analysis.`
    : "";

  const systemPrompt = chinese
    ? `你是一个智能YouTube视频分析助手。你的任务是根据视频字幕内容，生成高质量的总结分析。

## 输出格式
返回合法JSON：
{
  "zh": "<Markdown格式的中文分析>"
}

## Markdown要求
- **自由决定结构**：根据视频内容选择最合适的格式。可以用段落、列表、表格、对比、分级标题等任意组合。
- **时间戳链接**：在相关内容旁自然地插入时间戳，格式为 \`[MM:SS](t:秒数)\`，例如 \`[2:15](t:135)\`。不需要单独的时间线章节，而是让时间戳融入叙述中。
- **有深度**：不要只是罗列要点，要有分析、有观点、有结构。像一个真正看懂了视频的人在给朋友讲解。
- **可读性**：善用格式让内容容易扫读。

## 可用时间点参考
${timeline}`
    : `You are an intelligent YouTube video analysis assistant. Your job is to produce a high-quality, insightful summary based on the video transcript.

## Output format
Return valid JSON:
{
  "en": "<Markdown analysis in English>",
  "zh": "<Markdown analysis in Chinese>"
}

## Markdown guidelines
- **Choose the best structure for the content.** Use whatever combination of paragraphs, bullet lists, tables, comparisons, headings, etc. fits the video. A tech tutorial needs a different format than a debate or a vlog.
- **Embed timestamps naturally** using \`[MM:SS](t:<seconds>)\` format, e.g. \`[2:15](t:135)\`. Weave them into your narrative near the relevant content — do NOT put them in a separate timeline section.
- **Be insightful, not mechanical.** Go beyond listing points — provide analysis, context, and structure like someone who truly understood the video explaining it to a friend.
- **Optimize for scannability.** Use formatting wisely so readers can quickly find what matters.
- **Chinese version** should be natural Chinese writing, not a translation. Adapt structure and expression for Chinese readers.

## Available timestamp references
${timeline}`;

  const userMsg = chinese
    ? `请分析以下YouTube视频字幕：\n\n${transcript.slice(0, 12000)}${userInstruction}`
    : `Please analyze this YouTube video transcript:\n\n${transcript.slice(0, 12000)}${userInstruction}`;

  const response = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Qwen API error:", errorText);
    throw new Error(`Qwen API request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from Qwen API");
  }

  try {
    const parsed = JSON.parse(content);

    if (chinese) {
      return {
        en: "",
        zh: parsed.zh || parsed.content || content,
      };
    }

    return {
      en: parsed.en || parsed.content || "",
      zh: parsed.zh || "",
    };
  } catch {
    // If JSON parse fails, treat raw content as markdown
    return { en: content, zh: "" };
  }
}

/**
 * Placeholder when no API key is set.
 */
function placeholderSummarize(transcript: string): SummaryResult {
  const preview = transcript.slice(0, 500);
  const md = `## Summary\n\nNo API key configured. Here's a preview of the transcript:\n\n> ${preview}...`;
  return { en: md, zh: md };
}
