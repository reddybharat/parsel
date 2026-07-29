import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Moon, Pencil, Sun } from "lucide-react";

import { renameCategory } from "@/api/tracker";
import { StatusAlert } from "@/components/feedback/StatusAlert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import {
  setTrackerConfigCategories,
  trackerConfigQueryOptions,
} from "@/lib/trackerConfigQuery";
import { useTheme, type Theme } from "@/lib/theme";
import type { Category } from "@/lib/types";

type FormState = {
  firstName: string;
  lastName: string;
  username: string;
  theme: Theme;
};

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { username, email, firstName, lastName, preferences, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    username: "",
    theme: "light",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    data: trackerConfig,
    isPending: categoriesLoading,
    isError: categoriesFailed,
    error: categoriesErr,
  } = useQuery({
    ...trackerConfigQueryOptions(),
    enabled: open,
  });
  const categories = trackerConfig?.categories ?? [];
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryBusyName, setCategoryBusyName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCategoryError(null);
    setForm({
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      username: username ?? "",
      theme: preferences?.theme ?? theme,
    });
  }, [open, firstName, lastName, username, preferences, theme]);

  useEffect(() => {
    if (!open || !categoriesFailed) return;
    setCategoryError(
      categoriesErr instanceof Error ? categoriesErr.message : "Could not load categories.",
    );
  }, [open, categoriesFailed, categoriesErr]);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      await updateProfile({
        username: form.username.trim(),
        first_name: form.firstName.trim() || null,
        last_name: form.lastName.trim() || null,
        preferences: { theme: form.theme },
      });
      setTheme(form.theme);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRename() {
    if (!renaming) return;
    const name = renameDraft.trim().replace(/\s+/g, " ");
    if (!name) {
      setCategoryError("Please enter a category name.");
      return;
    }
    setCategoryBusyName(renaming.name);
    setCategoryError(null);
    try {
      const updated = await renameCategory(renaming.name, name);
      const next = categories
        .map((item) =>
          item.name.toLocaleLowerCase() === renaming.name.toLocaleLowerCase() ? updated : item,
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      setTrackerConfigCategories(next);
      setRenaming(null);
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Could not rename category.");
    } finally {
      setCategoryBusyName(null);
    }
  }

  const customCategories = categories.filter((item) => item.is_system === false);

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight text-parsel-neutral">
            Settings
          </DialogTitle>
        </DialogHeader>
        {error ? <StatusAlert variant="error" title={error} /> : null}
        <FieldGroup className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="settings-first-name">First name</FieldLabel>
            <Input
              id="settings-first-name"
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
              disabled={loading}
              autoComplete="given-name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-last-name">Last name</FieldLabel>
            <Input
              id="settings-last-name"
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              disabled={loading}
              autoComplete="family-name"
            />
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="settings-username">Username</FieldLabel>
            <Input
              id="settings-username"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              disabled={loading}
              autoComplete="username"
            />
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel>Email</FieldLabel>
            <Input value={email ?? ""} disabled readOnly />
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel>Theme</FieldLabel>
            <div className="flex items-center gap-3 rounded-none border border-parsel-border bg-parsel-soft px-3 py-2">
              <Sun className="size-4 text-parsel-muted" aria-hidden />
              <Switch
                checked={form.theme === "dark"}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, theme: checked ? "dark" : "light" }))
                }
                disabled={loading}
                aria-label="Dark mode"
              />
              <Moon className="size-4 text-parsel-muted" aria-hidden />
              <span className="text-sm text-parsel-muted">
                {form.theme === "dark" ? "Dark" : "Light"}
              </span>
            </div>
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel>Custom categories</FieldLabel>
            {categoryError ? (
              <p className="mt-1 text-sm text-destructive">{categoryError}</p>
            ) : null}
            {categoriesLoading ? (
              <p className="mt-2 text-sm text-parsel-muted">Loading categories…</p>
            ) : customCategories.length === 0 ? (
              <p className="mt-2 text-sm text-parsel-muted">
                No custom categories yet. Create one when adding a transaction.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-parsel-border border border-parsel-border">
                {customCategories.map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-sm text-parsel-neutral">{item.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={categoryBusyName === item.name || loading}
                      onClick={() => {
                        setRenaming(item);
                        setRenameDraft(item.name);
                        setCategoryError(null);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Rename
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={loading}>
            {loading ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(renaming)} onOpenChange={(next) => !categoryBusyName && !next && setRenaming(null)}>
      <DialogContent className="max-w-md sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
            Rename category
          </DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="settings-rename-category">Name</FieldLabel>
          <Input
            id="settings-rename-category"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            maxLength={40}
            disabled={Boolean(categoryBusyName)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRename();
              }
            }}
          />
          {categoryError ? <p className="text-sm text-destructive">{categoryError}</p> : null}
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={Boolean(categoryBusyName)}
            onClick={() => setRenaming(null)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={Boolean(categoryBusyName)} onClick={() => void handleRename()}>
            {categoryBusyName ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
