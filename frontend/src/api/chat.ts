import { postJson } from "./client";
import type { ChatReply } from "../lib/types";

export function invokeChat(message: string) {
  return postJson<ChatReply>("/chat/invoke", { message });
}

export function resumeChat(threadId: string, message: string) {
  return postJson<ChatReply>("/chat/resume", { thread_id: threadId, message });
}

export function exitChat(threadId: string) {
  return postJson<{ status: string }>("/chat/exit", { thread_id: threadId });
}
