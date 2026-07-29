import { useEffect, useState } from "react";

import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const TICK_MS = 700;
const START_VALUE = 12;
const INCREMENT = 18;
// Never reach 100 while waiting: completion is owned by the caller's real state.
const CEILING = 90;

export function InlineProgress({
  label,
  value,
  className,
}: {
  label: string;
  value?: number;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [autoValue, setAutoValue] = useState(START_VALUE);

  useEffect(() => {
    if (isControlled) return;
    const intervalId = window.setInterval(() => {
      setAutoValue((current) => Math.min(CEILING, current + INCREMENT));
    }, TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [isControlled]);

  return (
    <Progress
      value={isControlled ? value : autoValue}
      className={cn("w-full gap-1.5", className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <ProgressLabel>{label}</ProgressLabel>
        <ProgressValue className="text-xs" />
      </div>
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  );
}
