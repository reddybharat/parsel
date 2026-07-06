"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { MessageScroller as MessageScrollerPrimitive } from "@shadcn/react/message-scroller"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function MessageScrollerProvider({
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>) {
  return <MessageScrollerPrimitive.Provider {...props} />
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      className={cn("group/message-scroller relative flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto outline-none", className)}
      {...props}
    />
  )
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

function MessageScrollerItem({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      className={cn("[content-visibility:auto] [contain-intrinsic-size:auto_5rem]", className)}
      {...props}
    />
  )
}

function MessageScrollerButton({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
  return (
    <MessageScrollerPrimitive.Button
      className={className}
      render={
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "absolute bottom-4 end-4 z-10 size-8 rounded-full shadow-md",
            "opacity-0 transition-opacity group-data-[scrollable=end]/message-scroller:opacity-100",
            "data-[active=false]:pointer-events-none data-[active=false]:opacity-0",
            className
          )}
          aria-label="Scroll to latest message"
        >
          <ChevronDown className="size-4" />
        </Button>
      }
      {...props}
    />
  )
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
}
