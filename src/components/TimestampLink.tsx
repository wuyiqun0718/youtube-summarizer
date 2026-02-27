"use client";

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { seekTo } from "./YouTubePlayer";

export interface FrameData {
  timestamp: number;
  imagePath: string;
}

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

export default function TimestampLink({
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
