import * as React from "react"

import { cn } from "@/lib/utils"

function Marker({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2", className)} {...props} />
}

function MarkerIcon({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 items-center", className)} {...props} />
}

function MarkerContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-parsel-muted", className)} {...props} />
}

export { Marker, MarkerIcon, MarkerContent }
