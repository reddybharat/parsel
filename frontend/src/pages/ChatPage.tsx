import { useState } from "react";
import ReactMarkdown from "react-markdown";

import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { LoadingState } from "../components/feedback/LoadingState";
import { exitChat, invokeChat, resumeChat } from "../api/chat";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Total spend this month?",
  "Category breakdown this month?",
  "Last 10 transactions?",
  "Where did I spend most?",
];

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="flex items-center justify-between">
        <h2 className="text-[38px] font-semibold tracking-tight text-parsel-neutral">AI Assistant</h2>
        <button className="rounded-lg bg-parsel-primary px-4 py-2 text-sm font-semibold text-white">Add Transaction</button>
      </div>

      <section className="rounded-xl border border-parsel-border bg-white">
        <header className="flex items-center justify-between border-b border-parsel-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#e7effb] px-2 py-1 text-xs text-parsel-primary">✦</span>
            <h3 className="text-xl font-semibold">AI Assistant</h3>
          </div>
          <button className="text-xs uppercase tracking-wide text-parsel-secondary" onClick={() => void reset()} disabled={processing}>
            Reset Session
          </button>
        </header>

        <div className="space-y-4 px-4 py-4">
          {messages.length === 0 && (
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

          {processing ? <LoadingState label="AI assistant is thinking..." /> : null}

          <div className="space-y-2">
            {messages.length === 0 && !processing ? (
              <EmptyState title="No conversation yet" detail="Start with a prompt to get spending insights." />
            ) : (
              messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`rounded-xl border border-parsel-border p-3 text-sm ${
                    message.role === "user" ? "ml-auto max-w-[72%] bg-[#f2efee]" : "max-w-[86%] bg-[#f8fafd]"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold uppercase text-parsel-muted">{message.role}</p>
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </article>
              ))
            )}
          </div>
        </div>

        <form
          className="border-t border-parsel-border px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <div className="flex items-center rounded-xl border border-parsel-border bg-[#fbfcff] px-3">
            <span className="text-parsel-muted">⌇</span>
            <input
              className="w-full border-0 bg-transparent px-3 py-3 text-sm outline-none"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type your financial question..."
              disabled={processing}
            />
            <button
              className="rounded-md bg-parsel-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              type="submit"
              disabled={processing || !draft.trim()}
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
