"use client";

import { useState, useMemo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TimestampLink, { type FrameData } from "./TimestampLink";

interface SummaryDisplayProps {
  en?: string;
  zh?: string;
  videoId?: string;
  frames?: FrameData[];
  framesLoading?: boolean;
  onAnalyzeFrames?: () => void;
}
export default function SummaryDisplay({
  en,
  zh,
  videoId,
  frames,
  framesLoading,
  onAnalyzeFrames,
}: SummaryDisplayProps) {
  const [lang, setLang] = useState<"en" | "zh">("en");

  const hasBilingual = !!(en && zh);
  const content = hasBilingual
    ? lang === "zh"
      ? zh
      : en
    : zh || en || "";

  const components = useMemo(
    () => ({
      a: ({ href, children }: ComponentPropsWithoutRef<"a">) => (
        <TimestampLink href={href} videoId={videoId} frames={frames}>
          {children}
        </TimestampLink>
      ),
      h1: ({ children }: ComponentPropsWithoutRef<"h1">) => (
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3 first:mt-0">
          {children}
        </h1>
      ),
      h2: ({ children }: ComponentPropsWithoutRef<"h2">) => (
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-5 mb-2.5 first:mt-0">
          {children}
        </h2>
      ),
      h3: ({ children }: ComponentPropsWithoutRef<"h3">) => (
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mt-4 mb-2">
          {children}
        </h3>
      ),
      p: ({ children }: ComponentPropsWithoutRef<"p">) => (
        <p className="text-[15px] leading-7 text-zinc-600 dark:text-zinc-300 mb-3">
          {children}
        </p>
      ),
      ul: ({ children }: ComponentPropsWithoutRef<"ul">) => (
        <ul className="space-y-1.5 mb-3 ml-1">{children}</ul>
      ),
      ol: ({ children }: ComponentPropsWithoutRef<"ol">) => (
        <ol className="space-y-1.5 mb-3 ml-1 list-decimal list-inside">
          {children}
        </ol>
      ),
      li: ({ children }: ComponentPropsWithoutRef<"li">) => (
        <li className="text-[15px] leading-6 text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
          <span className="text-emerald-400 mt-1.5 shrink-0">•</span>
          <span>{children}</span>
        </li>
      ),
      blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
        <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-600 pl-4 my-3 text-zinc-400 italic">
          {children}
        </blockquote>
      ),
      table: ({ children }: ComponentPropsWithoutRef<"table">) => (
        <div className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }: ComponentPropsWithoutRef<"th">) => (
        <th className="text-left px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold border border-zinc-300 dark:border-zinc-700">
          {children}
        </th>
      ),
      td: ({ children }: ComponentPropsWithoutRef<"td">) => (
        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/50">
          {children}
        </td>
      ),
      strong: ({ children }: ComponentPropsWithoutRef<"strong">) => (
        <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">
          {children}
        </strong>
      ),
      em: ({ children }: ComponentPropsWithoutRef<"em">) => (
        <em className="text-zinc-400">{children}</em>
      ),
      code: ({ children }: ComponentPropsWithoutRef<"code">) => (
        <code className="text-sm bg-zinc-100 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded">
          {children}
        </code>
      ),
      hr: () => (
        <div className="border-t border-zinc-200 dark:border-zinc-800/60 my-4" />
      ),
    }),
    [videoId, frames]
  );

  return (
    <div className="space-y-4">
      {hasBilingual && (
        <div className="flex items-center gap-1 bg-zinc-200 dark:bg-zinc-800/60 rounded-lg p-1 w-fit">
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              lang === "en"
                ? "bg-blue-500/20 text-blue-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang("zh")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              lang === "zh"
                ? "bg-blue-500/20 text-blue-400 shadow-sm"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            中文
          </button>
        </div>
      )}

      {/* Frame analysis status */}
      {onAnalyzeFrames && (!frames || frames.length === 0) && !framesLoading && (
        <button
          onClick={onAnalyzeFrames}
          className="px-4 py-2 text-sm rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          🖼 Analyze Key Frames
        </button>
      )}
      {framesLoading && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <svg
            className="animate-spin h-4 w-4"
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
          Extracting & analyzing key frames...
        </div>
      )}
      {frames && frames.length > 0 && (
        <div className="text-xs text-zinc-500">
          ✨ {frames.length} key frames analyzed — hover timestamps to
          preview
        </div>
      )}

      <div className="summary-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={components}
          urlTransform={(url) => url}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
