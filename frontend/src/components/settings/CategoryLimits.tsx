import { useState } from "react";
import { Pencil } from "lucide-react";

import { setCategoryLimit } from "@/api/tracker";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { invalidateDashboardOverview } from "@/lib/dashboardQuery";
import { formatInrAmount } from "@/lib/format";
import { setTrackerConfigCategories } from "@/lib/trackerConfigQuery";
import type { Category } from "@/lib/types";

export function CategoryLimits({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openEdit(category: Category) {
    setEditing(category);
    setDraft(category.monthly_limit === null ? "" : String(category.monthly_limit));
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (busy || next) return;
    setEditing(null);
    setError(null);
  }

  async function handleSave() {
    if (!editing) return;
    const trimmed = draft.trim();
    const limit = trimmed === "" ? null : Number(trimmed);
    if (limit !== null && (!Number.isFinite(limit) || limit <= 0)) {
      setError("Limit must be above zero. Leave it empty for no limit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await setCategoryLimit(editing.name, limit);
      setTrackerConfigCategories(
        categories.map((item) => (item.name === updated.name ? updated : item)),
      );
      void invalidateDashboardOverview();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save limit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <h3 className="text-sm font-medium text-parsel-neutral">Monthly limits</h3>
      <p className="mb-2 text-xs text-parsel-muted">Budget cards on the Overview track spend against these.</p>
      <ul className="max-w-md divide-y divide-parsel-border border border-parsel-border">
        {categories.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="min-w-0 truncate text-sm text-parsel-neutral" title={item.name}>
              {item.name}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm text-parsel-muted">
                {item.monthly_limit === null ? "No limit" : formatInrAmount(item.monthly_limit)}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(item)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Drawer open={editing !== null} onOpenChange={handleOpenChange}>
        <DrawerContent className="sm:max-w-md" showCloseButton={!busy}>
          <DrawerHeader>
            <DrawerTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Monthly limit: {editing?.name}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <Field>
              <FieldLabel htmlFor="category-limit">Limit (₹ per month)</FieldLabel>
              <Input
                id="category-limit"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <FieldDescription>Leave empty to remove the limit.</FieldDescription>
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DrawerFooter className="shrink-0">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
