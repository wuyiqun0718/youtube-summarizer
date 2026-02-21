"use client";

import { useState, useMemo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { seekTo } from "./YouTubePlayer";

interface SummaryDisplayProps {
  en?: string;
  zh?: string;
  videoId?: string;
}

/**
 * Parse timestamp links like [1:23](t:83) and make them clickable.
 * Also handles [1:23:45](t:4425).
 */
function TimestampLink({
  href,
  children,
  videoId,
}: {
  href?: string;
  children?: React.ReactNode;
  videoId?: string;
}) {
  const match = href?.match(/^t:(\d+)$/);
  if (!match) {
    // Regular link
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
      >
        {children}
      </a>
    );
  }

  const seconds = parseInt(match[1], 10);
  return (
    <button
      onClick={() => seekTo(seconds)}
      className="inline-flex items-center gap-1 text-sm font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md hover:bg-purple-500/20 hover:text-purple-300 transition-all cursor-pointer"
      title={`Jump to ${children}`}
    >
      {children}
      {videoId && (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-zinc-600 hover:text-red-400 transition-colors ml-0.5"
          title="Open on YouTube"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19V6.413L11.2071 14.2071L9.79289 12.7929L17.585 5H13V3H21Z" />
          </svg>
        </a>
      )}
    </button>
  );
}

export default function SummaryDisplay({
  en,
  zh,
  videoId,
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
        <TimestampLink href={href} videoId={videoId}>
          {children}
        </TimestampLink>
      ),
      h1: ({ children }: ComponentPropsWithoutRef<"h1">) => (
        <h1 className="text-xl font-bold text-zinc-100 mt-6 mb-3 first:mt-0">
          {children}
        </h1>
      ),
      h2: ({ children }: ComponentPropsWithoutRef<"h2">) => (
        <h2 className="text-lg font-semibold text-zinc-100 mt-5 mb-2.5 first:mt-0">
          {children}
        </h2>
      ),
      h3: ({ children }: ComponentPropsWithoutRef<"h3">) => (
        <h3 className="text-base font-semibold text-zinc-200 mt-4 mb-2">
          {children}
        </h3>
      ),
      p: ({ children }: ComponentPropsWithoutRef<"p">) => (
        <p className="text-[15px] leading-7 text-zinc-300 mb-3">{children}</p>
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
        <li className="text-[15px] leading-6 text-zinc-300 flex items-start gap-2">
          <span className="text-emerald-400 mt-1.5 shrink-0">•</span>
          <span>{children}</span>
        </li>
      ),
      blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
        <blockquote className="border-l-2 border-zinc-600 pl-4 my-3 text-zinc-400 italic">
          {children}
        </blockquote>
      ),
      table: ({ children }: ComponentPropsWithoutRef<"table">) => (
        <div className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }: ComponentPropsWithoutRef<"th">) => (
        <th className="text-left px-3 py-2 bg-zinc-800 text-zinc-200 font-semibold border border-zinc-700">
          {children}
        </th>
      ),
      td: ({ children }: ComponentPropsWithoutRef<"td">) => (
        <td className="px-3 py-2 text-zinc-300 border border-zinc-700/50">
          {children}
        </td>
      ),
      strong: ({ children }: ComponentPropsWithoutRef<"strong">) => (
        <strong className="text-zinc-100 font-semibold">{children}</strong>
      ),
      em: ({ children }: ComponentPropsWithoutRef<"em">) => (
        <em className="text-zinc-400">{children}</em>
      ),
      code: ({ children }: ComponentPropsWithoutRef<"code">) => (
        <code className="text-sm bg-zinc-800 text-emerald-300 px-1.5 py-0.5 rounded">
          {children}
        </code>
      ),
      hr: () => <div className="border-t border-zinc-800/60 my-4" />,
    }),
    [videoId]
  );

  return (
    <div className="space-y-4">
      {/* Language Toggle */}
      {hasBilingual && (
        <div className="flex items-center gap-1 bg-zinc-800/60 rounded-lg p-1 w-fit">
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

      {/* Markdown Content */}
      <div className="summary-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
