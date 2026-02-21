import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-100 hover:text-white transition-colors"
        >
          YT Summarizer
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/history"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            History
          </Link>
        </div>
      </div>
    </nav>
  );
}
