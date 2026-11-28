import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Check, Copy, SquarePen, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link, useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { ErrorState } from "../components/feedback/ErrorState";
import { exitChat, invokeChat, resumeChat } from "../api/chat";
import { ParselMark } from "@/components/brand/ParselMark";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const LEDGER_SEARCH_PATH = "/ledger/search";
const COPIED_RESET_MS = 1500;

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

const ACTION_BUTTON_CLASS =
  "flex h-7 items-center gap-1.5 px-1.5 text-[11px] text-parsel-muted transition-[color,transform] duration-150 ease-out hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary active:scale-[0.97]";

/** Assistant column: Parsel chip on the left, content beside it (answer, thinking, stopped). */
function AssistantMessage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Message align="start" className={className}>
      <MessageAvatar className="self-start">
        <span className="flex size-6 items-center justify-center bg-parsel-nav-active-bg text-parsel-nav-active-text">
          <ParselMark className="size-4" />
        </span>
      </MessageAvatar>
      <MessageContent className="w-full max-w-[72ch]">{children}</MessageContent>
    </Message>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      console.warn("Chat: copying the answer to the clipboard failed", err);
    }
  }

  return (
    <button type="button" className={ACTION_BUTTON_CLASS} onClick={() => void copy()}>
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function ChatMessageRow({ message, isLatest }: { message: ChatMessage; isLatest: boolean }) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent className="max-w-[75%]">
          <Bubble className="border-transparent bg-parsel-soft">
            <BubbleContent className="py-2.5">
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  return (
    <AssistantMessage className="chat-message-enter">
      <div className="chat-markdown pt-0.5 text-sm text-parsel-text">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
      <MessageFooter
        className={cn(
          "-ml-1.5 gap-0 transition-opacity duration-150 ease-out focus-within:opacity-100 group-hover/message:opacity-100 [@media(hover:none)]:opacity-100",
          isLatest ? "opacity-100" : "opacity-0",
        )}
      >
        <CopyButton text={message.content} />
        <Link to={LEDGER_SEARCH_PATH} className={ACTION_BUTTON_CLASS}>
          <ArrowUpRight className="size-3.5" aria-hidden />
          Verify in Ledger
        </Link>
      </MessageFooter>
    </AssistantMessage>
  );
}

function ThinkingRow() {
  return (
    <AssistantMessage>
      <Marker role="status" aria-live="polite" aria-atomic="true" className="min-h-6">
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
    </AssistantMessage>
  );
}

function StoppedRow() {
  return (
    <AssistantMessage>
      <Marker role="status" aria-live="polite" aria-atomic="true" className="min-h-6">
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
    </AssistantMessage>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const sentUrlQuestionRef = useRef(false);

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

  // Overview question chips link here as /chat?q=…; send once, then drop the param.
  useEffect(() => {
    const question = searchParams.get("q")?.trim();
    if (!question || sentUrlQuestionRef.current) return;
    sentUrlQuestionRef.current = true;
    setSearchParams({}, { replace: true });
    void send(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            className="-my-1.5 -mr-2 flex h-8 shrink-0 items-center gap-1.5 px-2 text-xs font-semibold text-parsel-secondary transition-[color,transform] duration-150 ease-out hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
            type="button"
            onClick={() => void reset()}
            disabled={processing || messages.length === 0}
          >
            <SquarePen className="size-3.5" aria-hidden />
            New chat
          </button>
        </header>

        <MessageScrollerProvider autoScroll>
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport className="p-6 md:p-8">
              <MessageScrollerContent className="flex-1 gap-6">
                {messages.length === 0 && !processing && (
                  <div className="m-auto flex w-full max-w-xl flex-col gap-4 py-6">
                    <span className="flex size-8 items-center justify-center bg-parsel-nav-active-bg text-parsel-nav-active-text">
                      <ParselMark className="size-5" />
                    </span>
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

                {messages.map((message, index) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <div className="flex flex-col gap-3">
                      <ChatMessageRow
                        message={message}
                        isLatest={index === messages.length - 1 && !processing}
                      />
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
          <div className="flex items-end gap-2 rounded-none border border-parsel-border bg-parsel-soft px-3 py-1.5 focus-within:border-parsel-primary focus-within:ring-1 focus-within:ring-parsel-primary">
            {/* shortcut: field-sizing auto-grows in Chromium only; elsewhere the box stays one row and scrolls. Add JS resize if Safari/Firefox users complain. */}
            <textarea
              className="max-h-40 min-h-9 w-full resize-none border-0 bg-transparent px-1 py-2 text-sm leading-5 outline-none [field-sizing:content] placeholder:text-parsel-muted disabled:cursor-not-allowed disabled:opacity-50"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-parsel-primary text-sm text-primary-foreground transition-[opacity,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-parsel-primary disabled:pointer-events-none disabled:opacity-50"
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
            {processing ? "Esc to stop" : "Answers can be wrong."}
          </p>
        </form>
      </section>
    </div>
  );
}
