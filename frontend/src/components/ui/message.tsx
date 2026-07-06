import * as React from "react"

import { cn } from "@/lib/utils"

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-align={align}
      className={cn(
        "group/message flex w-full gap-3",
        align === "end" ? "flex-row justify-end" : "flex-row justify-start",
        className
      )}
      {...props}
    />
  )
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 self-end", className)} {...props} />
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-[86%] flex-col gap-1",
        "group-data-[align=end]/message:items-end",
        className
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-xs text-parsel-muted", className)} {...props} />
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs text-parsel-muted",
        "group-data-[align=end]/message:justify-end",
        className
      )}
      {...props}
    />
  )
}

export { MessageGroup, Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader }
