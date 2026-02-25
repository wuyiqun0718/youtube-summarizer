"use client";

import { useState, useRef, useCallback, useMemo, type ComponentPropsWithoutRef } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { seekTo } from "./YouTubePlayer";

interface FrameData {
  timestamp: number;
  imagePath: string;
}

interface SummaryDisplayProps {
  en?: string;
  zh?: string;
  videoId?: string;
  frames?: FrameData[];
  framesLoading?: boolean;
  onAnalyzeFrames?: () => void;
}

/**
 * Popover rendered via portal to avoid overflow clipping.
 * Supports mouse entering the popover without it disappearing.
 */
function FramePopover({
  frame,
  pos,
  onMouseEnter,
  onMouseLeave,
}: {
  frame: FrameData;
  pos: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return createPortal(
    <div
      className="fixed z-[100]"
      style={{
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
        paddingBottom: 12,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="bg-zinc-900 rounded-lg shadow-2xl border border-zinc-700 p-2 w-96">
        <img
          src={frame.imagePath}
          alt={`Frame at ${frame.timestamp}s`}
          className="w-full rounded"
          loading="eager"
        />
      </div>
    </div>,
    document.body
  );
}

function TimestampLink({
  href,
  children,
  videoId,
  frames,
}: {
  href?: string;
  children?: React.ReactNode;
  videoId?: string;
  frames?: FrameData[];
}) {
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const match = href?.match(/^tv?:(\d+)$/);
  if (!match) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline underline-offset-2"
      >
        {children}
      </a>
    );
  }

  const seconds = parseInt(match[1], 10);
  const isVisual = href?.startsWith("tv:");
  const frame = isVisual
    ? frames?.find((f) => Math.abs(f.timestamp - seconds) <= 5)
    : undefined;

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => setPopoverPos(null), 150);
  }, [cancelHide]);

  const handleMouseEnter = () => {
    cancelHide();
    if (ref.current && frame) {
      const rect = ref.current.getBoundingClientRect();
      const popoverWidth = 384;
      let left = rect.left + rect.width / 2;
      left = Math.max(
        popoverWidth / 2 + 8,
        Math.min(left, window.innerWidth - popoverWidth / 2 - 8)
      );
      setPopoverPos({ top: rect.top - 8, left });
    }
  };

  return (
    <span
      ref={ref}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={scheduleHide}
    >
      <button
        onClick={() => seekTo(seconds)}
        className="inline-flex items-center gap-1 text-sm font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md hover:bg-purple-500/20 hover:text-purple-300 transition-all cursor-pointer"
        title={`Jump to ${children}`}
      >
        {children}
        {frame && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
        )}
        {videoId && (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-zinc-600 hover:text-red-400 transition-colors ml-0.5"
            title="Open on YouTube"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19V6.413L11.2071 14.2071L9.79289 12.7929L17.585 5H13V3H21Z" />
            </svg>
          </a>
        )}
      </button>
      {popoverPos && frame && (
        <FramePopover
          frame={frame}
          pos={popoverPos}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </span>
  );
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
