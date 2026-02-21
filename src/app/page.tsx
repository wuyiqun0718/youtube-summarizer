"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import UrlInput from "@/components/UrlInput";
import YouTubePlayer from "@/components/YouTubePlayer";
import SummaryDisplay from "@/components/SummaryDisplay";
import TranscriptPanel from "@/components/TranscriptPanel";
import ChatPanel from "@/components/ChatPanel";

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

export default function Home() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoData | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "chat" | "transcript">("summary");

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

  const handleSubmit = async (url: string, prompt?: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to summarize video");
      }

      setVideo({
        youtube_id: data.video.youtube_id,
        title: data.video.title,
        en: data.video.en || "",
        zh: data.video.zh || "",
        captions: data.video.captions,
      });
      setFavorited(!!data.video.favorited);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
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
        <UrlInput onSubmit={handleSubmit} loading={loading} />
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {video && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 lg:h-[calc(100vh-10rem)]">
          {/* Left: Video Player — sticky */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 truncate flex-1">
                {video.title}
              </h2>
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
