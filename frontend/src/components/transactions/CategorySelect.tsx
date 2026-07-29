import { useState } from "react";

import { createCategory } from "@/api/tracker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { setTrackerConfigCategories } from "@/lib/trackerConfigQuery";
import type { Category } from "@/lib/types";

const CREATE_VALUE = "__create_category__";

export function CategorySelect({
  id,
  value,
  categories,
  onChange,
  onCategoriesChange,
  required,
  placeholder = "Select Category",
  allowEmpty = true,
  size = "default",
  invalid,
  disabled,
}: {
  id?: string;
  value: string;
  categories: Category[];
  onChange: (name: string) => void;
  onCategoriesChange?: (next: Category[]) => void;
  required?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  size?: "xs" | "sm" | "default";
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setDraft("");
    setError(null);
    setOpen(true);
  }

  function handleSelectChange(next: string) {
    if (next === CREATE_VALUE) {
      openCreate();
      return;
    }
    onChange(next);
  }

  async function handleCreate() {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Please enter a category name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createCategory(name);
      const withoutDup = categories.filter(
        (item) => item.name.toLocaleLowerCase() !== created.name.toLocaleLowerCase(),
      );
      const next = [...withoutDup, created].sort((a, b) => a.name.localeCompare(b.name));
      setTrackerConfigCategories(next);
      onCategoriesChange?.(next);
      onChange(created.name);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => handleSelectChange(e.target.value)}
        required={required}
        size={size}
        disabled={disabled}
        aria-invalid={invalid}
      >
        {allowEmpty ? <NativeSelectOption value="">{placeholder}</NativeSelectOption> : null}
        {categories.map((item) => (
          <NativeSelectOption key={item.name} value={item.name}>
            {item.name}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value={CREATE_VALUE}>+ Create new category…</NativeSelectOption>
      </NativeSelect>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="max-w-md sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Create category
            </DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`${id ?? "category"}-new-name`}>Name</FieldLabel>
            <FieldDescription>
              New names are shared once used on a transaction. Matching ignores case.
            </FieldDescription>
            <Input
              id={`${id ?? "category"}-new-name`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Pet Care"
              maxLength={40}
              autoFocus
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleCreate()}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
