"use client";

import { useState, FormEvent } from "react";

interface UrlInputProps {
  onSubmit: (url: string, prompt?: string) => void;
  loading: boolean;
}

export default function UrlInput({ onSubmit, loading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim() && !loading) {
      onSubmit(url.trim(), prompt.trim() || undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-2xl bg-white dark:bg-zinc-700/50 border border-zinc-300 dark:border-zinc-600/60 shadow-lg shadow-zinc-300/30 dark:shadow-black/20 focus-within:ring-2 focus-within:ring-blue-500/70 focus-within:border-blue-500/30 transition-all overflow-hidden backdrop-blur-sm">
        {/* URL input */}
        <div className="px-5 py-3.5">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube URL here..."
            className="w-full bg-transparent text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-400 focus:outline-none text-[15px]"
            disabled={loading}
          />
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-zinc-500/25" />

        {/* Custom instructions */}
        <div className="px-5 py-2.5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Custom instructions (optional)..."
            className="w-full bg-transparent text-zinc-600 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none text-sm resize-none focus:text-zinc-800 dark:focus:text-zinc-200 transition-colors"
            rows={1}
            disabled={loading}
          />
        </div>

        {/* Bottom bar */}
        <div className="flex justify-end px-4 py-2.5 bg-zinc-100/50 dark:bg-zinc-700/30">
          <button
            type="submit"
            disabled={!url.trim() || loading}
            className="px-5 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 disabled:opacity-35 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-500/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              "Summarize"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
