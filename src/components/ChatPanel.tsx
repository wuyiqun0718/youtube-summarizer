"use client";

import { useState, useRef, useEffect, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { seekTo } from "./YouTubePlayer";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  videoId: string;
  captions: { start: number; dur: number; text: string }[];
}

function TimestampLink({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  const match = href?.match(/^t:(\d+)$/);
  if (!match) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:underline"
      >
        {children}
      </a>
    );
  }
  const seconds = parseInt(match[1], 10);
  return (
    <button
      onClick={() => seekTo(seconds)}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline underline-offset-2 cursor-pointer"
    >
      {children}
    </button>
  );
}

export type { ChatMessage };

export default function ChatPanel({ videoId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from DB
  useEffect(() => {
    setHistoryLoaded(false);
    fetch(`/api/chat/history?videoId=${videoId}`)
      .then(res => res.json())
      .then(data => setMessages(data.messages || []))
      .catch(() => setMessages([]))
      .finally(() => setHistoryLoaded(true));
  }, [videoId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          message: text,
          history: messages,
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || "No response.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Failed to get response. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const markdownComponents = {
    a: ({ href, children, ...props }: ComponentPropsWithoutRef<"a">) => (
      <TimestampLink href={href}>{children}</TimestampLink>
    ),
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && historyLoaded && (
          <div className="text-center text-zinc-400 dark:text-zinc-500 py-12 text-sm">
            Ask anything about this video...
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-500 text-white dark:bg-blue-600"
                  : "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    urlTransform={(url) => url}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-200 dark:bg-zinc-700 rounded-2xl px-4 py-3">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 p-3">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask about this video..."
            className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Send
          </button>
          {messages.length > 0 && (
            <button
              onClick={async () => {
                await fetch(`/api/chat/history?videoId=${videoId}`, { method: "DELETE" });
                setMessages([]);
              }}
              className="text-zinc-400 hover:text-red-400 transition-colors shrink-0 p-2"
              title="Clear chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
