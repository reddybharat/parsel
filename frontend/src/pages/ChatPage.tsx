import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { ErrorState } from "../components/feedback/ErrorState";
import { exitChat, invokeChat, resumeChat } from "../api/chat";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";

const LEDGER_SEARCH_PATH = "/ledger/search";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Total spend this month?",
  "Category breakdown this month?",
  "Last 10 transactions?",
  "Where did I spend most?",
];

const CHAT_UNKNOWN_ERROR = "Couldn't get an answer. Check your connection and try again.";

const NETWORK_ERROR_HINTS = [
  "failed to fetch",
  "network",
  "networkerror",
  "timeout",
  "connection",
  "offline",
  "econnrefused",
  "load failed",
  "fetch failed",
];

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function formatChatError(err: unknown): string {
  if (!(err instanceof Error)) {
    return CHAT_UNKNOWN_ERROR;
  }
  const message = err.message.trim();
  if (!message) {
    return CHAT_UNKNOWN_ERROR;
  }
  const lower = message.toLowerCase();
  if (NETWORK_ERROR_HINTS.some((hint) => lower.includes(hint))) {
    return CHAT_UNKNOWN_ERROR;
  }
  if (/\n\s*at\s/.test(message) || message.length > 200) {
    return CHAT_UNKNOWN_ERROR;
  }
  return message;
}

function ChatMessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <Message align="start">
      <MessageContent className={isUser ? "max-w-[68%]" : "max-w-full"}>
        <div className="flex flex-col gap-1">
          <Bubble
            className={
              isUser
                ? "border-parsel-border/50 bg-parsel-soft/50 text-parsel-secondary"
                : "border-parsel-border bg-parsel-surface font-medium text-parsel-text"
            }
          >
            <BubbleContent className={!isUser ? "chat-markdown" : undefined}>
              {isUser ? (
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              )}
            </BubbleContent>
          </Bubble>
          {!isUser ? (
            <Link
              to={LEDGER_SEARCH_PATH}
              className="self-start text-[11px] text-parsel-muted transition-colors hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary"
            >
              Verify in Ledger
            </Link>
          ) : null}
        </div>
      </MessageContent>
    </Message>
  );
}

function ThinkingRow() {
  return (
    <Message align="start">
      <MessageContent className="max-w-full">
        <Marker role="status" aria-live="polite" aria-atomic="true">
          <MarkerIcon>
            <Spinner
              className="size-4 text-parsel-primary"
              aria-hidden
              aria-label={undefined}
              role="presentation"
            />
          </MarkerIcon>
          <MarkerContent className="shimmer">Reading your ledger…</MarkerContent>
        </Marker>
      </MessageContent>
    </Message>
  );
}

function StoppedRow() {
  return (
    <Message align="start">
      <MessageContent className="max-w-full">
        <Marker role="status" aria-live="polite" aria-atomic="true">
          <MarkerIcon>
            <Square
              className="size-4 text-parsel-muted"
              strokeWidth={0}
              fill="currentColor"
              aria-hidden
            />
          </MarkerIcon>
          <MarkerContent>Stopped — ask again when ready</MarkerContent>
        </Marker>
      </MessageContent>
    </Message>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  // Keep user bubble; muted Stopped marker below (no draft restore).
  const [stoppedMessageIds, setStoppedMessageIds] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightAnchorIdRef = useRef<string | null>(null);

  function stopProcessing() {
    abortRef.current?.abort();
  }

  function markStopped(anchorMessageId: string) {
    setStoppedMessageIds((prev) =>
      prev.includes(anchorMessageId) ? prev : [...prev, anchorMessageId],
    );
  }

  async function send(message: string, options?: { isRetry?: boolean }) {
    if (!message.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    const retainedError = options?.isRetry ? error : null;

    let anchorMessageId: string;
    if (options?.isRetry) {
      const lastUser = [...messages].reverse().find((item) => item.role === "user");
      anchorMessageId = lastUser?.id ?? crypto.randomUUID();
    } else {
      anchorMessageId = crypto.randomUUID();
    }
    inFlightAnchorIdRef.current = anchorMessageId;
    // Drop stale stop marker for this turn before thinking / retry.
    setStoppedMessageIds((prev) => prev.filter((id) => id !== anchorMessageId));

    setProcessing(true);
    setError(null);
    if (!options?.isRetry) {
      const userMessage: ChatMessage = { id: anchorMessageId, role: "user", content: message };
      setMessages((prev) => [...prev, userMessage]);
      setDraft("");
      setFailedMessage(null);
    }
    try {
      let response;
      if (threadId) {
        try {
          response = await resumeChat(threadId, message, signal);
        } catch (err) {
          if (isAbortError(err)) throw err;
          const errorMessage = err instanceof Error ? err.message : "";
          if (errorMessage.includes("404")) {
            setThreadId(null);
            response = await invokeChat(message, signal);
          } else {
            throw err;
          }
        }
      } else {
        response = await invokeChat(message, signal);
      }
      setThreadId(response.thread_id);
      setFailedMessage(null);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply || "No answer came back. Try again.",
        },
      ]);
    } catch (err) {
      if (isAbortError(err)) {
        if (retainedError) setError(retainedError);
        if (abortRef.current === controller && inFlightAnchorIdRef.current) {
          markStopped(inFlightAnchorIdRef.current);
        }
        return;
      }
      setError(formatChatError(err));
      setFailedMessage(message);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        inFlightAnchorIdRef.current = null;
        setProcessing(false);
      }
    }
  }

  async function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlightAnchorIdRef.current = null;
    setProcessing(false);
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
    setFailedMessage(null);
    setStoppedMessageIds([]);
  }

  function retryFailedSend() {
    if (failedMessage) {
      void send(failedMessage, { isRetry: true });
    }
  }

  const showMidThreadSuggestions = messages.length > 0 && !processing && !error;

  return (
    <div className="flex h-full min-h-0 w-full justify-center bg-parsel-canvas">
      <section className="flex h-full min-h-0 w-full max-w-content flex-col rounded-none border-x border-parsel-border bg-parsel-surface shadow-none">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-parsel-border px-6 py-2 md:px-8">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-parsel-primary">Parsel AI</p>
            <span className="text-[11px] text-parsel-muted">your ledger</span>
          </div>
          <button
            className="shrink-0 text-xs font-semibold uppercase tracking-wide text-parsel-secondary transition-colors hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary disabled:pointer-events-none disabled:opacity-50"
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
              <MessageScrollerContent className="gap-3">
                {messages.length === 0 && !processing && (
                  <div className="mx-auto flex max-w-xl flex-col gap-4 py-6">
                    <div className="space-y-1.5">
                      <h2 className="text-sm font-semibold leading-snug text-parsel-text">
                        Ask about your ₹ transaction history — read-only, no money moves.
                      </h2>
                      <p className="text-xs text-parsel-muted">
                        Answers are pulled from your imported ledger data.
                      </p>
                    </div>
                    <div className="grid gap-1.5 md:grid-cols-2">
                      {SUGGESTIONS.map((item) => (
                        <button
                          key={item}
                          className="rounded-none border border-parsel-border bg-parsel-surface px-3 py-2 text-left text-sm text-parsel-text transition-colors hover:border-parsel-primary hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary disabled:pointer-events-none disabled:opacity-50"
                          onClick={() => void send(item)}
                          disabled={processing}
                          type="button"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <div className="flex flex-col gap-1.5">
                      <ChatMessageRow message={message} />
                      {stoppedMessageIds.includes(message.id) ? <StoppedRow /> : null}
                    </div>
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
          className="shrink-0 border-t border-parsel-border px-6 py-3 md:px-8"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (!processing) void send(draft);
          }}
          onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
            if (event.key === "Escape" && processing) {
              event.preventDefault();
              stopProcessing();
            }
          }}
        >
          {showMidThreadSuggestions ? (
            <details className="mb-1.5">
              <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide text-parsel-muted transition-colors hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary [&::-webkit-details-marker]:hidden">
                Try a prompt
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Suggested prompts">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    className="rounded-none border border-parsel-border bg-parsel-surface px-2.5 py-1 text-[11px] leading-snug text-parsel-muted transition-colors hover:border-parsel-primary hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => void send(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
          <div className="flex items-center gap-2 rounded-none border border-parsel-border bg-parsel-soft px-3 py-1 focus-within:border-parsel-primary focus-within:ring-1 focus-within:ring-parsel-primary">
            <input
              className="w-full border-0 bg-transparent px-1 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about your transactions…"
              aria-label="Ask about your transactions"
            />
            {processing ? (
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-parsel-border bg-parsel-surface text-parsel-secondary transition-colors hover:border-parsel-primary hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary"
                type="button"
                onClick={stopProcessing}
                aria-label="Stop"
              >
                <Square className="size-3.5 fill-current" strokeWidth={0} />
              </button>
            ) : (
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-parsel-primary text-sm text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary disabled:pointer-events-none disabled:opacity-50"
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send message"
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
          {error ? (
            <div className="mt-2">
              <ErrorState message={error} onRetry={failedMessage ? retryFailedSend : undefined} />
            </div>
          ) : null}
          <p className="mt-2 text-center text-[11px] text-parsel-muted">
            {processing ? (
              "Esc to stop"
            ) : (
              <>
                Answers can be wrong.{" "}
                <Link
                  to={LEDGER_SEARCH_PATH}
                  className="text-parsel-muted underline-offset-2 transition-colors hover:text-parsel-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary"
                >
                  Verify against your transactions
                </Link>
                .
              </>
            )}
          </p>
        </form>
      </section>
    </div>
  );
}
