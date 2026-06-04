import { useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { exitChat, invokeChat, resumeChat } from "../api/chat";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Total spend this month?",
  "Category breakdown this month?",
  "Last 10 transactions?",
  "Where did I spend most?",
];

function AssistantAvatar() {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full bg-[#e7effb]"
      aria-hidden
    >
      <svg className="h-4 w-4 text-parsel-primary" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.5l1.2 3.6 3.8 1.2-3.8 1.2L12 12.5 10.8 8.9 7 7.7l3.8-1.2L12 2.5zm0 9.5l.9 2.7 2.9.9-2.9.9-.9 2.7-.9-2.7-2.9-.9 2.9-.9.9-2.7z" />
      </svg>
    </span>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <AssistantAvatar />
      <div
        className="rounded-xl border border-parsel-border bg-[#f8fafd] px-4 py-3 text-sm text-parsel-muted"
        role="status"
        aria-live="polite"
      >
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-parsel-primary [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-parsel-primary [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-parsel-primary [animation-delay:300ms]" />
          </span>
          Thinking...
        </span>
      </div>
    </div>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = bottomRef.current;
    if (!anchor) return;
    const behavior = messages.length > 0 ? "smooth" : "auto";
    anchor.scrollIntoView({ behavior, block: "end" });
    // Markdown tables/layout can grow after first paint
    const id = requestAnimationFrame(() => {
      anchor.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, processing]);

  async function send(message: string) {
    if (!message.trim()) return;
    setProcessing(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
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
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply || "No reply received." }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed.");
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
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
    <div className="space-y-4">
      <section className="flex max-h-[min(720px,calc(100dvh-12rem))] flex-col rounded-xl border border-parsel-border bg-white">
        <header className="flex shrink-0 items-center justify-between border-b border-parsel-border px-4 py-3">
          <div className="flex items-center gap-2">
            <AssistantAvatar />
            <h2 className="text-xl font-semibold">AI Assistant</h2>
          </div>
          <button
            className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary hover:text-parsel-primary"
            type="button"
            onClick={() => void reset()}
            disabled={processing}
          >
            Reset Session
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {messages.length === 0 && !processing && (
              <div className="space-y-2 rounded-lg border border-parsel-border bg-[#fafcff] p-3">
                <p className="text-sm text-parsel-muted">Try one of these prompts:</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      className="rounded-lg border border-parsel-border px-3 py-2 text-left text-sm hover:bg-parsel-soft"
                      onClick={() => void send(item)}
                      disabled={processing}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.length === 0 && !processing ? (
                <EmptyState title="No conversation yet" detail="Start with a prompt to get spending insights." />
              ) : (
                messages.map((message, index) => (
                  <article
                    key={`${message.role}-${index}`}
                    className={`flex items-start gap-2 text-sm ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" ? <AssistantAvatar /> : null}
                    <div
                      className={`max-w-[86%] rounded-xl border border-parsel-border p-3 ${
                        message.role === "user" ? "bg-[#f2efee]" : "bg-[#f8fafd] chat-markdown"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>

            {processing ? <ThinkingIndicator /> : null}
            <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
          </div>
        </div>

        <form
          className="shrink-0 border-t border-parsel-border px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-parsel-border bg-[#fbfcff] px-3 py-1">
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-parsel-primary text-sm text-white disabled:opacity-50"
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
