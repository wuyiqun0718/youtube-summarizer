"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import UrlInput from "@/components/UrlInput";
import YouTubePlayer from "@/components/YouTubePlayer";
import SummaryDisplay from "@/components/SummaryDisplay";
import TranscriptPanel from "@/components/TranscriptPanel";
import ChatPanel from "@/components/ChatPanel";
import VideoTagEditor from "@/components/VideoTagEditor";

interface CaptionSegment {
  start: number;
  dur: number;
  text: string;
}

interface VideoData {
  youtube_id: string;
  title: string;
  en: string;
  zh: string;
  captions?: CaptionSegment[];
  favorited?: boolean;
}

interface FrameData {
  timestamp: number;
  imagePath: string;
}

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoData | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "chat" | "transcript">("summary");
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [framesLoading, setFramesLoading] = useState(false);
  const [showResummarize, setShowResummarize] = useState(false);
  const [resummarizePrompt, setResummarizePrompt] = useState("");
  const [allVisual, setAllVisual] = useState(false);

  useEffect(() => {
    const videoId = searchParams.get("v");
    if (videoId) {
      setLoading(true);
      fetch(`/api/history?id=${videoId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.video) {
            setVideo({
              youtube_id: data.video.youtube_id,
              title: data.video.title,
              en: data.video.en || "",
              zh: data.video.zh || "",
              captions: data.video.captions,
            });
            setFavorited(!!data.video.favorited);
          }
        })
        .catch(() => setError("Failed to load video from history"))
        .finally(() => setLoading(false));
    }
  }, [searchParams]);

  // Fetch existing frames when video changes
  useEffect(() => {
    if (!video?.youtube_id) {
      setFrames([]);
      return;
    }
    fetch(`/api/frames?videoId=${video.youtube_id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.frames?.length > 0) setFrames(d.frames);
      })
      .catch(() => {});
  }, [video?.youtube_id]);

  // Preload frame images for instant hover
  useEffect(() => {
    frames.forEach((f) => {
      const img = new Image();
      img.src = f.imagePath;
    });
  }, [frames]);

  const handleAnalyzeFrames = async () => {
    if (!video) return;
    setFramesLoading(true);
    try {
      const res = await fetch("/api/frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.youtube_id }),
      });
      const data = await res.json();
      if (data.frames) setFrames(data.frames);
    } catch (err) {
      console.error("Frame analysis failed:", err);
    } finally {
      setFramesLoading(false);
    }
  };

  const handleFavorite = async () => {
    if (!video) return;
    try {
      const res = await fetch("/api/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.youtube_id }),
      });
      const data = await res.json();
      setFavorited(data.favorited);
    } catch { /* ignore */ }
  };

  const handleResummarize = async (customPrompt: string) => {
    if (!video) return;
    setShowResummarize(false);
    setLoading(true);
    setError(null);
    setFrames([]);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${video.youtube_id}`,
          title: video.title,
          prompt: customPrompt,
          force: true,
          allVisual,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to re-summarize");

      const vid = {
        youtube_id: data.video.youtube_id,
        title: data.video.title,
        en: data.video.en || "",
        zh: data.video.zh || "",
        captions: data.video.captions,
      };
      setVideo(vid);
      setFavorited(!!data.video.favorited);

      // Auto-extract frames when allVisual is on
      if (allVisual) {
        setFramesLoading(true);
        fetch("/api/frames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: vid.youtube_id }),
        })
          .then((r) => r.json())
          .then((d) => { if (d.frames) setFrames(d.frames); })
          .catch(() => {})
          .finally(() => setFramesLoading(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (url: string, prompt?: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, prompt, allVisual }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to summarize video");
      }

      const vid = {
        youtube_id: data.video.youtube_id,
        title: data.video.title,
        en: data.video.en || "",
        zh: data.video.zh || "",
        captions: data.video.captions,
      };
      setVideo(vid);
      setFavorited(!!data.video.favorited);
      router.replace(`/?v=${data.video.youtube_id}`, { scroll: false });

      // Auto-extract frames when allVisual is on
      if (allVisual && !data.cached) {
        setFramesLoading(true);
        fetch("/api/frames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: vid.youtube_id }),
        })
          .then((r) => r.json())
          .then((d) => { if (d.frames) setFrames(d.frames); })
          .catch(() => {})
          .finally(() => setFramesLoading(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      {/* Re-summarize Modal */}
      {showResummarize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Re-summarize
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Optionally provide custom instructions for this summary.
            </p>
            <textarea
              value={resummarizePrompt}
              onChange={(e) => setResummarizePrompt(e.target.value)}
              placeholder="e.g. Focus on practical exercises and include more visual timestamps..."
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleResummarize(resummarizePrompt);
                }
              }}
            />
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allVisual}
                onChange={(e) => setAllVisual(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500/40"
              />
              🖼 Extract frames for all timestamps
            </label>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResummarize(false)}
                className="px-4 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResummarize(resummarizePrompt)}
                className="px-4 py-2 text-sm rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
              >
                Summarize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          YouTube Video Summarizer
        </h1>
        <p className="text-zinc-400">
          Paste a YouTube URL to get an AI-powered analysis with timestamps
          and insights.
        </p>
      </div>

      {/* URL Input */}
      <div className="max-w-2xl mx-auto mb-8">
        <UrlInput onSubmit={handleSubmit} loading={loading} allVisual={allVisual} onAllVisualChange={setAllVisual} />
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {video && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 lg:h-[calc(100vh-10rem)]">
          {/* Left: Video Player — sticky */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 truncate flex-1">
                {video.title}
              </h2>
              <button
                onClick={() => { setResummarizePrompt(""); setShowResummarize(true); }}
                disabled={loading}
                className="shrink-0 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-blue-500 disabled:opacity-40"
                title="Re-summarize"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleFavorite}
                className="shrink-0 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title={favorited ? "取消收藏" : "收藏"}
              >
                {favorited ? (
                  <svg className="w-6 h-6 text-yellow-400 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-zinc-500 hover:text-yellow-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
              </button>
            </div>
            <VideoTagEditor videoId={video.youtube_id} />
            <YouTubePlayer videoId={video.youtube_id} />
          </div>

          {/* Right: Summary/Chat — independent scroll */}
          <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 lg:overflow-hidden flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-700 shrink-0">
              <button
                onClick={() => setActiveTab("summary")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "summary"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "chat"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                Chat
              </button>
              {video.captions && video.captions.length > 0 && (
                <button
                  onClick={() => setActiveTab("transcript")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === "transcript"
                      ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  Transcript
                </button>
              )}
            </div>

            {/* Tab content — both mounted, toggle visibility to preserve state */}
            <div className={`p-6 overflow-y-auto flex-1 ${activeTab === "summary" ? "" : "hidden"}`}>
              <SummaryDisplay
                en={video.en}
                zh={video.zh}
                videoId={video.youtube_id}
                frames={frames}
                framesLoading={framesLoading}
                onAnalyzeFrames={handleAnalyzeFrames}
              />
            </div>
            <div className={`flex-1 overflow-hidden ${activeTab === "chat" ? "" : "hidden"}`}>
              <ChatPanel
                videoId={video.youtube_id}
                captions={video.captions || []}
              />
            </div>
            {video.captions && video.captions.length > 0 && (
              <div className={`p-6 overflow-y-auto flex-1 ${activeTab === "transcript" ? "" : "hidden"}`}>
                <TranscriptPanel captions={video.captions} videoId={video.youtube_id} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!video && !loading && !error && (
        <div className="text-center py-16 text-zinc-600">
          <svg
            className="mx-auto h-16 w-16 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-lg">Paste a YouTube URL above to get started</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-16">
          <svg
            className="animate-spin mx-auto h-10 w-10 text-blue-500 mb-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-zinc-400">
            Analyzing video...
          </p>
          <p className="text-zinc-600 text-sm mt-1">This may take a moment</p>
        </div>
      )}
    </div>
  );
}
