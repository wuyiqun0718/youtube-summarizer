# YouTube Summarizer

AI-powered YouTube video analysis tool. Paste a URL, get an insightful markdown summary with embedded clickable timestamps — in both English and Chinese.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Qwen](https://img.shields.io/badge/LLM-Qwen-blue) ![SQLite](https://img.shields.io/badge/DB-SQLite-green)

## Features

- **Smart summaries** — The LLM chooses the best format for each video (paragraphs, tables, comparisons, etc.), not a fixed template
- **Embedded timestamps** — Clickable `[MM:SS]` links jump to the exact moment in the embedded player
- **Bilingual** — English & Chinese summaries with one-click toggle
- **Custom instructions** — Guide the analysis (e.g. "focus on technical details", "compare pros and cons in a table")
- **Captions** — YouTube API with Whisper local fallback for videos without subtitles
- **History & favorites** — All summaries saved locally with search
- **Transcript panel** — Full transcript with clickable timestamps

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **LLM**: Qwen (通义千问) via DashScope API
- **Database**: SQLite (better-sqlite3)
- **Captions**: YouTube Transcript API + [whisper.cpp](https://github.com/ggerganov/whisper.cpp) fallback

## Setup

### Prerequisites

- Node.js 20+
- A [DashScope API key](https://dashscope.console.aliyun.com/) for Qwen
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
# Download a model (e.g. small)
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
3. Click **Summarize**
4. Toggle between English/Chinese, click timestamps to jump in the video

## License

MIT
