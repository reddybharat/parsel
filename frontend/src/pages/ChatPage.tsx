import { FormEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { exitChat, invokeChat, resumeChat } from "../api/chat";
import { ParselMark } from "@/components/brand/ParselMark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth";
import { initialsFromProfile } from "@/lib/profile";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Total spend this month?",
  "Category breakdown this month?",
  "Last 10 transactions?",
  "Where did I spend most?",
];

function ParselAvatar() {
  return (
    <Avatar className="h-8 w-8">
      <AvatarFallback className="bg-parsel-nav-active-bg text-parsel-nav-active-text">
        <span className="sr-only">Parsel</span>
        <ParselMark className="h-5 w-5" />
      </AvatarFallback>
    </Avatar>
  );
}

function UserAvatar({ initials }: { initials: string }) {
  return (
    <Avatar className="h-8 w-8">
      <AvatarFallback className="bg-parsel-avatar-bg text-xs font-semibold text-parsel-secondary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function ChatMessageRow({
  message,
  userInitials,
}: {
  message: ChatMessage;
  userInitials: string;
}) {
  const isUser = message.role === "user";

  return (
    <Message align={isUser ? "end" : "start"}>
      {!isUser ? (
        <MessageAvatar>
          <ParselAvatar />
        </MessageAvatar>
      ) : null}
      <MessageContent>
        <Bubble className={isUser ? "bg-parsel-soft" : undefined}>
          <BubbleContent className={!isUser ? "chat-markdown" : undefined}>
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            )}
          </BubbleContent>
        </Bubble>
      </MessageContent>
      {isUser ? (
        <MessageAvatar>
          <UserAvatar initials={userInitials} />
        </MessageAvatar>
      ) : null}
    </Message>
  );
}

function ThinkingRow() {
  return (
    <Message align="start">
      <MessageAvatar>
        <ParselAvatar />
      </MessageAvatar>
      <MessageContent>
        <Marker role="status" aria-live="polite">
          <MarkerIcon>
            <Spinner className="size-4 text-parsel-primary" />
          </MarkerIcon>
          <MarkerContent className="shimmer">Generating response…</MarkerContent>
        </Marker>
      </MessageContent>
    </Message>
  );
}

export function ChatPage() {
  const { firstName, lastName, username, email } = useAuth();
  const userInitials = initialsFromProfile(firstName, lastName, username ?? email);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(message: string) {
    if (!message.trim()) return;
    setProcessing(true);
    setError(null);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    try {
      let response;
      if (threadId) {
        try {
          response = await resumeChat(threadId, message);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "";
          if (errorMessage.includes("404")) {
            setThreadId(null);
            response = await invokeChat(message);
          } else {
            throw err;
          }
        }
      } else {
        response = await invokeChat(message);
      }
      setThreadId(response.thread_id);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: response.reply || "No reply received." },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed.");
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setProcessing(false);
    }
  }

  async function reset() {
    if (threadId) {
      try {
        await exitChat(threadId);
      } catch {
        // Ignore reset failure; local reset still proceeds.
      }
    }
    setThreadId(null);
    setMessages([]);
    setDraft("");
    setError(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <section className="mx-auto flex h-full min-h-0 w-full max-w-content flex-col rounded-none border border-parsel-border bg-parsel-surface shadow-none">
        <header className="flex shrink-0 justify-end border-b border-parsel-border px-6 py-3 md:px-8">
          <button
            className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary hover:text-parsel-primary"
            type="button"
            onClick={() => void reset()}
            disabled={processing}
          >
            Reset Session
          </button>
        </header>

        <MessageScrollerProvider autoScroll>
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport className="p-6 md:p-8">
              <MessageScrollerContent>
                {messages.length === 0 && !processing && (
                  <div className="space-y-4">
                    <div className="space-y-2 rounded-none border border-parsel-border bg-parsel-soft p-3">
                      <p className="text-sm text-parsel-muted">Try one of these prompts:</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {SUGGESTIONS.map((item) => (
                          <button
                            key={item}
                            className="rounded-none border border-parsel-border px-3 py-2 text-left text-sm hover:bg-parsel-soft"
                            onClick={() => void send(item)}
                            disabled={processing}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <EmptyState title="No conversation yet" detail="Start with a prompt to get spending insights." />
                  </div>
                )}

                {messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <ChatMessageRow message={message} userInitials={userInitials} />
                  </MessageScrollerItem>
                ))}

                {processing ? (
                  <MessageScrollerItem messageId="thinking">
                    <ThinkingRow />
                  </MessageScrollerItem>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        <form
          className="shrink-0 border-t border-parsel-border px-6 py-4 md:px-8"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="flex items-center gap-2 rounded-none border border-parsel-border bg-parsel-soft px-3 py-1">
            <button className="text-parsel-muted opacity-50" type="button" disabled aria-label="Attach file (coming soon)">
              📎
            </button>
            <input
              className="w-full border-0 bg-transparent px-1 py-3 text-sm outline-none"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type your financial question..."
              disabled={processing}
            />
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-parsel-primary text-sm text-primary-foreground disabled:opacity-50"
              type="submit"
              disabled={processing || !draft.trim()}
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-parsel-muted">Parsel AI can make mistakes. Verify important transactions.</p>
        </form>
      </section>
      {error ? <ErrorState message={error} /> : null}
    </div>
  );
}
