import { cn } from "@/lib/utils";

type ParselMarkProps = {
  className?: string;
  /**
   * `boxed` keeps the square field the glyph is centered in — for chips, tiles, and app icons.
   * `fitted` crops to the ink so the mark can be aligned to the cap height of adjacent type.
   */
  fit?: "boxed" | "fitted";
  /** Grid units, for optical weight matching against neighbouring type or icons. */
  strokeWidth?: number;
};

/** Parsel logo: a prompt caret reading into a squared P, drawn in `currentColor`. */
export function ParselMark({ className, fit = "boxed", strokeWidth = 2 }: ParselMarkProps) {
  return (
    <svg
      className={cn("shrink-0", className)}
      viewBox={fit === "fitted" ? "5 6 14 12" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      focusable="false"
      aria-hidden
    >
      <path d="M6 8.5L9.5 12 6 15.5" />
      <path d="M13 17V7h5v5h-5" />
    </svg>
  );
}
