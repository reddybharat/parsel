import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"

import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

const LOADING_STEPS = [
  "Fetching overview…",
  "Loading spend trends…",
  "Loading category breakdown…",
  "Loading cash flow & activity…",
] as const

const STEP_INTERVAL_MS = 800

export function OverviewLoading() {
  const [stepIndex, setStepIndex] = useState(0)
  const progressValue = ((stepIndex + 1) / LOADING_STEPS.length) * 100
  const currentLabel = LOADING_STEPS[stepIndex]

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStepIndex((current) => Math.min(LOADING_STEPS.length - 1, current + 1))
    }, STEP_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center border border-parsel-border bg-parsel-surface p-6">
      <div className="w-full max-w-md space-y-6">
        <Progress value={progressValue} className="w-full">
          <div className="flex items-center justify-between gap-3">
            <ProgressLabel>{currentLabel}</ProgressLabel>
            <ProgressValue />
          </div>
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>

        <div className="flex flex-col gap-2 border border-parsel-border bg-parsel-soft/40 p-4">
          {LOADING_STEPS.map((label, index) => {
            if (index > stepIndex) return null

            const isComplete = index < stepIndex
            const isActive = index === stepIndex

            return (
              <Marker
                key={label}
                role={isActive ? "status" : undefined}
                aria-live={isActive ? "polite" : undefined}
              >
                <MarkerIcon>
                  {isComplete ? (
                    <CheckCircle2 className="size-4 text-parsel-inflow" />
                  ) : (
                    <Spinner className="size-4 text-parsel-primary" />
                  )}
                </MarkerIcon>
                <MarkerContent className={isActive ? "shimmer" : undefined}>{label}</MarkerContent>
              </Marker>
            )
          })}
        </div>
      </div>
    </div>
  )
}
