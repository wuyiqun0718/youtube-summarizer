declare module "youtube-captions-scraper" {
  interface CaptionOptions {
    videoID: string;
    lang?: string;
  }

  interface CaptionEntry {
    start: string;
    dur: string;
    text: string;
  }

  export function getSubtitles(
    options: CaptionOptions
  ): Promise<CaptionEntry[]>;
}
