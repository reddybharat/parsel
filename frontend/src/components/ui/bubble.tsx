import * as React from "react"

import { cn } from "@/lib/utils"

function Bubble({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl border border-parsel-border bg-parsel-soft text-sm text-parsel-text", className)}
      {...props}
    />
  )
}

function BubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-4 py-3", className)} {...props} />
}

export { Bubble, BubbleContent }
