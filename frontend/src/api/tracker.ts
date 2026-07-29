import { deleteJson, getBlob, getJson, patchJson, postJson, postMultipart } from "./client";
import type { Category, SearchResult, TrackerConfig, Transaction } from "../lib/types";

export type SortColumn = "transaction_date" | "amount" | "category" | "payment_method" | "description";

export type SearchParams = {
  start_date: string;
  end_date: string;
  /** Free-text contains-match over description, category and payment method. */
  q?: string;
  category?: string;
  payment_method?: string;
  is_debit?: boolean;
  sort_column: SortColumn;
  sort_desc: boolean;
  page: number;
  page_size: number;
};

export type ImportFieldIssue = {
  field: string;
  code: string;
  message: string;
};

export type ImportPreviewRow = {
  source_row: number;
  transaction_date: string;
  category: string;
  amount: string;
  is_debit: string;
  description: string | null;
  payment_method: string | null;
  issues: ImportFieldIssue[];
  is_ready: boolean;
  category_is_new: boolean;
};

export type ImportPreviewResult = {
  rows: ImportPreviewRow[];
  file_errors: string[];
  valid_row_count: number;
  new_categories: string[];
  errors: string[];
};

export type ReviewedImportRow = {
  source_row: number;
  amount: number;
  is_debit: boolean;
  category: string;
  payment_method: string | null;
  transaction_date: string;
  description: string | null;
};

export type ImportResult = {
  inserted: number;
  errors: string[];
  created_categories: string[];
};

export function fetchTrackerConfig() {
  return getJson<TrackerConfig>("/config/tracker");
}

export function createCategory(name: string) {
  return postJson<Category>("/categories", { name });
}

export function renameCategory(oldName: string, newName: string) {
  return patchJson<Category>("/categories", { old_name: oldName, new_name: newName });
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
  q?: string;
  category?: string;
  payment_method?: string;
  is_debit?: boolean;
}) {
  return getBlob("/transactions/export", params);
}

export function previewImportTransactions(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return postMultipart<ImportPreviewResult>("/transactions/import/preview", formData);
}

export function importReviewedTransactions(payload: {
  rows: ReviewedImportRow[];
  approved_new_categories: string[];
}) {
  return postJson<ImportResult>("/transactions/import/reviewed", payload);
}

export function importTransactions(file: File, options?: { createMissingCategories?: boolean }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("create_missing_categories", options?.createMissingCategories ? "true" : "false");
  return postMultipart<ImportResult>("/transactions/import", formData);
}

export function downloadImportTemplate() {
  return getBlob("/transactions/import-template");
}
