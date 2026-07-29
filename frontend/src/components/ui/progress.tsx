import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

type ProgressContextValue = {
  value: number
}

const ProgressContext = React.createContext<ProgressContextValue>({ value: 0 })

function Progress({
  className,
  value = 0,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value?: number
}) {
  const clamped = Math.min(100, Math.max(0, value ?? 0))

  return (
    <ProgressContext.Provider value={{ value: clamped }}>
      <div data-slot="progress" className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </ProgressContext.Provider>
  )
}

function ProgressLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-xs font-semibold uppercase tracking-wide text-parsel-secondary", className)}
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: React.ComponentProps<"span">) {
  const { value } = React.useContext(ProgressContext)

  return (
    <span className={cn("tabular-nums text-sm text-parsel-muted", className)} {...props}>
      {Math.round(value)}%
    </span>
  )
}

function ProgressTrack({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const { value } = React.useContext(ProgressContext)

  return (
    <ProgressPrimitive.Root
      value={value}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-none border border-parsel-border bg-parsel-soft",
        className,
      )}
      {...props}
    >
      {children}
    </ProgressPrimitive.Root>
  )
}

function ProgressIndicator({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Indicator>) {
  const { value } = React.useContext(ProgressContext)

  return (
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-parsel-primary transition-all duration-300 ease-out", className)}
      style={{ transform: `translateX(-${100 - value}%)` }}
      {...props}
    />
  )
}

export { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue }
