import type { Category } from "@/lib/types";

/** Normalize tracker config category payloads (objects or legacy strings). */
export function normalizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  const out: Category[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let name = "";
    let isSystem = false;
    if (typeof item === "string") {
      name = item.trim();
    } else if (item && typeof item === "object" && "name" in item) {
      const record = item as { name?: unknown; is_system?: unknown };
      name = typeof record.name === "string" ? record.name.trim() : "";
      isSystem = Boolean(record.is_system);
    }
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, is_system: isSystem });
  }
  return out;
}
