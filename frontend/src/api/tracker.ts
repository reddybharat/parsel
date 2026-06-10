import { deleteJson, getBlob, getJson, patchJson, postJson, postMultipart } from "./client";
import type { SearchResult, TrackerConfig, Transaction } from "../lib/types";

export type SearchParams = {
  start_date: string;
  end_date: string;
  category?: string;
  sort_column: "transaction_date" | "amount" | "category" | "payment_method" | "description";
  sort_desc: boolean;
  page: number;
  page_size: number;
};

export function fetchTrackerConfig() {
  return getJson<TrackerConfig>("/config/tracker");
}

export function searchTransactions(params: SearchParams) {
  return getJson<SearchResult>("/transactions/search", params);
}

export function createTransaction(payload: Partial<Transaction>) {
  return postJson<Transaction>("/transactions", payload);
}

export function updateTransaction(id: string, payload: Partial<Transaction>) {
  return patchJson<Transaction>(`/transactions/${id}`, payload);
}

export function deleteTransaction(id: string) {
  return deleteJson(`/transactions/${id}`);
}

export function exportTransactions(params: {
  start_date: string;
  end_date: string;
  category?: string;
  payment_method?: string;
}) {
  return getBlob("/transactions/export", params);
}

export function importTransactions(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return postMultipart<{ inserted: number; errors: string[] }>("/transactions/import", formData);
}

export function downloadImportTemplate() {
  return getBlob("/transactions/import-template");
}
