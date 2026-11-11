import type { Category } from "@/lib/types";

/** Normalize tracker config category payloads (objects or legacy strings). */
export function normalizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  const out: Category[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let name = "";
    let isSystem = false;
    let monthlyLimit: number | null = null;
    if (typeof item === "string") {
      name = item.trim();
    } else if (item && typeof item === "object" && "name" in item) {
      const record = item as { name?: unknown; is_system?: unknown; monthly_limit?: unknown };
      name = typeof record.name === "string" ? record.name.trim() : "";
      isSystem = Boolean(record.is_system);
      monthlyLimit = typeof record.monthly_limit === "number" ? record.monthly_limit : null;
    }
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, is_system: isSystem, monthly_limit: monthlyLimit });
  }
  return out;
}
