import { useState } from "react";
import ReactMarkdown from "react-markdown";

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
        <h2 className="text-lg font-semibold">AI Chat</h2>
        <button className="rounded border px-3 py-2 text-sm" onClick={() => void reset()} disabled={processing}>
          Reset chat
        </button>
      </div>

      {messages.length === 0 && (
        <div className="space-y-2 rounded border border-gray-200 p-3">
          <p className="text-sm text-gray-500">Try one of these prompts:</p>
          <div className="grid gap-2">
            {SUGGESTIONS.map((item) => (
              <button key={item} className="rounded border px-3 py-2 text-left text-sm" onClick={() => void send(item)} disabled={processing}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={`rounded p-3 text-sm ${message.role === "user" ? "bg-blue-50" : "bg-gray-50"}`}
          >
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">{message.role}</p>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </article>
        ))}
      </div>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          className="w-full rounded border p-3"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about your finances..."
          disabled={processing}
        />
        <button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit" disabled={processing || !draft.trim()}>
          {processing ? "Thinking..." : "Send"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
