# YouTube Summarizer

Next.js 应用，粘贴 YouTube 链接 → 获取字幕 → LLM 生成双语摘要 → 可视化关键帧 → 聊天追问。

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **DB**: SQLite via better-sqlite3 (WAL mode), 文件位于 `data/youtube-summarizer.db`
- **LLM**: 阿里百炼 Qwen API (dashscope compatible endpoint)
  - 摘要: `qwen-plus`
  - 聊天: `qwen-vl-plus` (支持图片理解)
- **字幕**: youtube-captions-scraper → Python youtube-transcript-api 回退 → Whisper (whisper-cli) 回退
- **帧提取**: yt-dlp (`-g` 获取直链) + ffmpeg 远程 seek，不下载完整视频
- **Markdown**: react-markdown + remark-gfm

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # 主页：URL输入、播放器、摘要、聊天
│   ├── history/page.tsx      # 历史记录页（含标签筛选）
│   ├── tags/page.tsx          # 标签管理页（CRUD、颜色选择）
│   ├── layout.tsx
│   └── api/
│       ├── summarize/route.ts   # 核心：字幕+章节获取→LLM摘要→存DB
│       ├── captions/route.ts    # 单独获取字幕
│       ├── chat/route.ts        # qwen-vl-plus 聊天，支持帧图片上下文
│       ├── chat/history/route.ts
│       ├── frames/route.ts      # GET/POST 帧提取
│       ├── history/route.ts     # 历史列表
│       ├── favorite/route.ts
│       ├── tags/route.ts        # GET/POST/PUT/DELETE 标签管理
│       └── videos/[id]/
│           ├── route.ts         # 删除视频
│           ├── favorite/route.ts
│           └── tags/route.ts    # GET/PUT 视频标签
├── components/
│   ├── SummaryDisplay.tsx    # 摘要渲染，含 FramePopover（tv: 时间戳悬浮预览）
│   ├── ChatPanel.tsx         # 聊天面板，含 includeTranscript 开关
│   ├── TranscriptPanel.tsx   # 字幕面板
│   ├── YouTubePlayer.tsx     # 嵌入式播放器
│   ├── UrlInput.tsx          # URL 输入框
│   ├── VideoTagEditor.tsx    # 视频标签编辑器（搜索、选择、创建标签）
│   ├── Navbar.tsx
│   └── ThemeProvider.tsx
├── lib/
│   ├── db.ts                 # SQLite schema + CRUD（videos, frames, tags, video_tags 表）
│   ├── llm.ts                # Qwen API 调用，摘要 prompt，tv:/t: 时间戳格式
│   ├── captions.ts           # 三层字幕获取（scraper → python → whisper）
│   ├── frames.ts             # yt-dlp + ffmpeg 帧提取
│   ├── youtube.ts            # fetchChapters (yt-dlp --dump-json)
│   └── format.ts             # 工具函数
├── types/
│   └── youtube-captions-scraper.d.ts
scripts/
├── batch-tag.ts              # 批量给无标签视频打标签（npx tsx scripts/batch-tag.ts）
├── transcribe.sh             # Whisper 转录脚本
└── fetch_captions.py         # Python youtube-transcript-api 回退
models/                       # Whisper 模型 (gitignored)
data/                         # SQLite DB (gitignored)
public/frames/                # 提取的帧图片 (gitignored)
```

## DB Schema

### videos 表
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | auto increment |
| youtube_id | TEXT UNIQUE | |
| title | TEXT | |
| thumbnail | TEXT | |
| summary_en | TEXT | 英文摘要 (markdown) |
| summary_zh | TEXT | 中文摘要 (markdown) |
| captions_raw | TEXT | 原始字幕 |
| chat_history | TEXT | JSON array |
| prompt | TEXT | 用户自定义指引 |
| chapters | TEXT | YouTube 章节 JSON |
| favorited | INTEGER | 0/1 |
| created_at | DATETIME | |

### frames 表
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| youtube_id | TEXT FK | |
| timestamp | REAL | 秒 |
| image_path | TEXT | public/frames/ 下的路径 |

### tags 表
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT UNIQUE | 标签名 |
| color | TEXT | 颜色 hex，默认 #6B7280 |
| created_at | DATETIME | |

### video_tags 表（多对多）
| Column | Type | Notes |
|--------|------|-------|
| video_id | TEXT PK | youtube_id FK → videos |
| tag_id | INTEGER PK | FK → tags，ON DELETE CASCADE |

## Key Conventions

### 时间戳格式 (LLM 输出)
- `[MM:SS](t:秒数)` — 普通时间戳，点击跳转
- `[MM:SS](tv:秒数)` — 视觉关键帧，显示绿点，悬浮预览帧截图
- SummaryDisplay 用 regex 解析两种格式，ChatPanel 目前只支持 `t:` 格式

### 标签系统
- LLM 分析视频时自动打标签（1-3 个宽泛分类）
- Prompt 注入现有标签列表，优先复用，避免过细
- 用户可在视频详情页手动编辑标签
- /tags 页面管理所有标签（增删改、颜色）
- 预设颜色池：#EF4444 #F97316 #EAB308 #22C55E #06B6D4 #3B82F6 #8B5CF6 #EC4899 #6B7280 #14B8A6

### 外部工具路径
- Python 3.12: `/opt/homebrew/bin/python3.12`
- whisper-cli: `/opt/homebrew/bin/whisper-cli`
- yt-dlp: 需在 PATH 中
- ffmpeg: 需在 PATH 中
- Whisper 模型: `models/ggml-small.bin`

## Dev

```bash
npm run dev    # 启动开发服务器
npm run build  # 构建
npm run lint   # ESLint
```

## Known Issues / TODO

- ChatPanel 的 TimestampLink 不支持 `tv:` 格式（聊天回复中的视觉帧链接无绿点/预览）
- 本地视频文件上传支持（未实现）
- 软删除（`is_deleted` 列，待实现）
- 重新摘要时复用缓存字幕（跳过字幕/章节获取，仅重跑 LLM，支持不同 prompt）
- 删除视频时清理 frames 记录 + 磁盘文件
