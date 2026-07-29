import type { ImportFieldIssue, ImportPreviewRow } from "../api/tracker";
import type { Category } from "./types";

export type EditableImportRow = ImportPreviewRow & {
  approved_new_category: boolean;
  imported: boolean;
};

/** Imported rows stay on screen for reference but can no longer be edited or selected. */
export function isRowSelectable(row: EditableImportRow): boolean {
  return row.is_ready && !row.imported;
}

const PAYMENT_METHODS = ["Cash", "UPI", "Bank transfer", "Card", "Wallet", "NEFT", "Other"];

function normalizeCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function categoryKey(name: string): string {
  return normalizeCategory(name).toLocaleLowerCase();
}

function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "").replace(/₹/g, "");
  if (!s) return null;
  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

function parseIsDebit(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (!s) return true;
  if (["true", "t", "1", "yes", "y"].includes(s)) return true;
  if (["false", "f", "0", "no", "n"].includes(s)) return false;
  return null;
}

function parseDate(raw: string): { valid: boolean; future: boolean } {
  const s = raw.trim();
  if (!s) return { valid: false, future: false };
  const iso = s.length >= 10 && s[4] === "-" && s[7] === "-" ? s.slice(0, 10) : s;
  const parsed = Date.parse(iso.includes("-") ? iso : s);
  if (Number.isNaN(parsed)) return { valid: false, future: false };
  const d = new Date(parsed);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return { valid: true, future: d > today };
}

export function toEditableRow(row: ImportPreviewRow): EditableImportRow {
  return { ...row, approved_new_category: false, imported: false };
}

export function isCategoryKnown(name: string, categories: Category[]): boolean {
  const key = categoryKey(name);
  return categories.some((item) => categoryKey(item.name) === key);
}

export function validateImportRow(
  row: EditableImportRow,
  categories: Category[],
): { issues: ImportFieldIssue[]; isReady: boolean } {
  const issues: ImportFieldIssue[] = [];
  const normalizedCategory = normalizeCategory(row.category);

  // Messages render directly under a narrow table cell, so they stay short; the field they
  // sit beneath already says which value is wrong.
  if (!row.transaction_date.trim()) {
    issues.push({
      field: "transaction_date",
      code: "required",
      message: "Required",
    });
  } else {
    const dateCheck = parseDate(row.transaction_date);
    if (!dateCheck.valid) {
      issues.push({
        field: "transaction_date",
        code: "invalid_format",
        message: "Use YYYY-MM-DD",
      });
    } else if (dateCheck.future) {
      issues.push({
        field: "transaction_date",
        code: "invalid_value",
        message: "Date is in the future",
      });
    }
  }

  if (!normalizedCategory) {
    issues.push({ field: "category", code: "required", message: "Required" });
  } else if (normalizedCategory.length > 40) {
    issues.push({
      field: "category",
      code: "invalid_value",
      message: "Max 40 characters",
    });
  }

  if (!row.amount.trim()) {
    issues.push({ field: "amount", code: "required", message: "Required" });
  } else {
    const amount = parseAmount(row.amount);
    if (amount === null) {
      issues.push({
        field: "amount",
        code: "invalid_format",
        message: "Not a number",
      });
    } else if (amount <= 0) {
      issues.push({
        field: "amount",
        code: "invalid_value",
        message: "Must be above 0",
      });
    }
  }

  const isDebit = parseIsDebit(row.is_debit);
  if (isDebit === null) {
    issues.push({
      field: "is_debit",
      code: "invalid_format",
      message: "Pick debit or credit",
    });
  }

  if (row.payment_method?.trim()) {
    if (!PAYMENT_METHODS.includes(row.payment_method.trim())) {
      issues.push({
        field: "payment_method",
        code: "invalid_value",
        message: "Pick a method",
      });
    }
  }

  const categoryIsNew =
    Boolean(normalizedCategory) &&
    !isCategoryKnown(normalizedCategory, categories) &&
    !issues.some((issue) => issue.field === "category");

  if (categoryIsNew && !row.approved_new_category) {
    issues.push({
      field: "category",
      code: "unknown_category",
      message: `"${normalizedCategory}" is not in your list yet. Pick an existing category or create this one.`,
    });
  }

  const blockingCodes = new Set(["required", "invalid_format", "invalid_value"]);
  const hasBlocking = issues.some((issue) => blockingCodes.has(issue.code));
  const isReady = !hasBlocking && (!categoryIsNew || row.approved_new_category);

  return { issues, isReady };
}

export function recomputeRow(row: EditableImportRow, categories: Category[]): EditableImportRow {
  const { issues, isReady } = validateImportRow(row, categories);
  return {
    ...row,
    issues,
    is_ready: isReady,
    category_is_new: Boolean(
      normalizeCategory(row.category) &&
        !isCategoryKnown(normalizeCategory(row.category), categories),
    ),
  };
}

export function toReviewedPayload(row: EditableImportRow): {
  source_row: number;
  amount: number;
  is_debit: boolean;
  category: string;
  payment_method: string | null;
  transaction_date: string;
  description: string | null;
} | null {
  const amount = parseAmount(row.amount);
  const isDebit = parseIsDebit(row.is_debit);
  const normalizedCategory = normalizeCategory(row.category);
  const dateCheck = parseDate(row.transaction_date);
  if (!row.is_ready || amount === null || isDebit === null || !normalizedCategory || !dateCheck.valid) {
    return null;
  }

  const isoDate =
    row.transaction_date.trim().length >= 10 && row.transaction_date[4] === "-"
      ? row.transaction_date.trim().slice(0, 10)
      : new Date(row.transaction_date).toISOString().slice(0, 10);

  return {
    source_row: row.source_row,
    amount,
    is_debit: isDebit,
    category: normalizedCategory,
    payment_method: row.payment_method?.trim() || null,
    transaction_date: isoDate,
    description: row.description?.trim() || null,
  };
}

export function collectApprovedNewCategories(rows: EditableImportRow[], categories: Category[]): string[] {
  const approved = new Set<string>();
  for (const row of rows) {
    if (!row.approved_new_category) continue;
    const name = normalizeCategory(row.category);
    if (name && !isCategoryKnown(name, categories)) {
      approved.add(name);
    }
  }
  return [...approved];
}
