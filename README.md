# YouTube Summarizer

AI-powered YouTube video analysis tool. Paste a URL, get an insightful markdown summary with embedded clickable timestamps — in both English and Chinese. Chat with the video using a vision-language model that can see key frames.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Qwen](https://img.shields.io/badge/LLM-Qwen-blue) ![SQLite](https://img.shields.io/badge/DB-SQLite-green)

## Features

- **Smart summaries** — The LLM chooses the best format for each video (paragraphs, tables, comparisons, etc.), not a fixed template
- **Embedded timestamps** — Clickable `[MM:SS]` links jump to the exact moment in the embedded player
- **Visual key frames** — Important moments marked with a green dot; hover to preview the actual video frame
- **Chat with the video** — Ask follow-up questions powered by Qwen-VL, which can "see" extracted frame screenshots
- **Bilingual** — English & Chinese summaries with one-click toggle
- **YouTube chapters** — Automatically fetched and used to improve timestamp accuracy
- **Custom instructions** — Guide the analysis (e.g. "focus on technical details", "compare pros and cons in a table")
- **Captions** — YouTube API → Python youtube-transcript-api → Whisper local fallback (three-tier)
- **History & favorites** — All summaries saved locally with search
- **Transcript panel** — Full transcript with clickable timestamps

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **LLM**: Qwen-Plus for summaries, Qwen-VL-Plus for chat (vision-language model)
- **Database**: SQLite (better-sqlite3)
- **Captions**: YouTube Transcript API + [whisper.cpp](https://github.com/ggerganov/whisper.cpp) fallback
- **Frame extraction**: yt-dlp + ffmpeg (remote seek, no full video download)

## Setup

### Prerequisites

- Node.js 20+
- A [DashScope API key](https://dashscope.console.aliyun.com/) for Qwen
- `yt-dlp` and `ffmpeg` for frame extraction
- (Optional) `whisper-cli` for videos without YouTube captions
- (Optional) Python 3 with `youtube-transcript-api` for caption fetching fallback

### Install

```bash
git clone https://github.com/wuyiqun0718/youtube-summarizer.git
cd youtube-summarizer
npm install
```

### Configure

Create `.env.local`:

```env
QWEN_API_KEY=your_dashscope_api_key
```

### (Optional) Whisper setup

For videos without YouTube captions, install [whisper.cpp](https://github.com/ggerganov/whisper.cpp) and download a model:

```bash
brew install whisper-cpp   # or build from source
mkdir -p models
curl -L -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Paste a YouTube URL
2. (Optional) Add custom instructions to guide the analysis
3. Click **Summarize** — get bilingual summaries with clickable timestamps
4. Hover over green-dot timestamps to preview key frames
5. Open the **Chat** panel to ask follow-up questions (the model can see video frames)
6. Toggle between English/Chinese, click timestamps to jump in the video

## License

MIT
