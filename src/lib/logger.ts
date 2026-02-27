/**
 * Simple structured logger with timing support.
 * Prefixes all logs with [tag] for easy filtering.
 */

export function createLogger(tag: string) {
  const prefix = `[${tag}]`;

  return {
    info: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
    /** Start a timer, returns a function that logs elapsed time */
    time: (label: string) => {
      const start = Date.now();
      console.log(prefix, `⏱ ${label}...`);
      return {
        end: (extra?: string) => {
          const ms = Date.now() - start;
          const timeStr = ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
          console.log(prefix, `✓ ${label} done (${timeStr})${extra ? ` — ${extra}` : ""}`);
        },
      };
    },
  };
}
