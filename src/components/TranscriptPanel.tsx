"use client";

import { useState } from "react";
import { seekTo } from "./YouTubePlayer";
import { formatTimestamp } from "@/lib/format";

interface CaptionSegment {
  start: number;
  dur: number;
  text: string;
}

interface TranscriptPanelProps {
  captions: CaptionSegment[];
  videoId?: string;
}

export default function TranscriptPanel({ captions, videoId }: TranscriptPanelProps) {
  const [open, setOpen] = useState(false);
  const [plainText, setPlainText] = useState(false);

  if (!captions || captions.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors group"
      >
        <span className="text-lg">📄</span>
        <span>Full Transcript</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-600 ml-1">
          ({captions.length} segments)
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {/* Toggle bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800/60">
            <div className="flex items-center gap-1 bg-zinc-200 dark:bg-zinc-800/60 rounded-lg p-0.5">
              <button
                onClick={() => setPlainText(false)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  !plainText
                    ? "bg-white dark:bg-zinc-700/50 text-zinc-800 dark:text-zinc-200 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-400"
                }`}
              >
                Interactive
              </button>
              <button
                onClick={() => setPlainText(true)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  plainText
                    ? "bg-white dark:bg-zinc-700/50 text-zinc-800 dark:text-zinc-200 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-400"
                }`}
              >
                Plain Text
              </button>
            </div>
            {plainText && (
              <button
                onClick={() => {
                  const text = captions.map((s) => s.text).join(" ");
                  navigator.clipboard.writeText(text);
                }}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy All
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[500px] overflow-y-auto p-4">
            {plainText ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-7 whitespace-pre-wrap select-text">
                {captions.map((s) => s.text).join(" ")}
              </p>
            ) : (
              <div className="space-y-0.5">
                {captions.map((seg, i) => (
                  <div key={i} className="flex items-start gap-1 group">
                    <button
                      onClick={() => seekTo(seg.start)}
                      className="flex-1 flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all text-left"
                    >
                      <span className="text-xs font-mono text-blue-400/70 bg-blue-500/5 px-2 py-1 rounded shrink-0 group-hover:bg-blue-500/15 group-hover:text-blue-300 transition-all min-w-[52px] text-center">
                        {formatTimestamp(seg.start)}
                      </span>
                      <span className="text-sm text-zinc-600 dark:text-zinc-400 leading-6 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
                        {seg.text}
                      </span>
                    </button>
                    {videoId && (
                      <a
                        href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seg.start)}s`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 shrink-0 text-zinc-400 dark:text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Open on YouTube"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19V6.413L11.2071 14.2071L9.79289 12.7929L17.585 5H13V3H21Z" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
