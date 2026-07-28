import { useEffect, useState } from "react";
import { Moon, Pencil, Sun } from "lucide-react";

import { fetchTrackerConfig, renameCategory } from "@/api/tracker";
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
import { normalizeCategories } from "@/lib/categories";
import { useTheme, type Theme } from "@/lib/theme";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
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
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setCategoriesLoading(true);
      setCategoryError(null);
      try {
        const config = await fetchTrackerConfig();
        if (cancelled) return;
        setCategories(normalizeCategories(config.categories));
      } catch (err) {
        if (cancelled) return;
        setCategoryError(err instanceof Error ? err.message : "Could not load categories.");
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

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
      setCategories((prev) =>
        prev
          .map((item) =>
            item.name.toLocaleLowerCase() === renaming.name.toLocaleLowerCase() ? updated : item,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
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
              autoComplete="given-name"
              disabled={loading}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-last-name">Last name</FieldLabel>
            <Input
              id="settings-last-name"
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              autoComplete="family-name"
              disabled={loading}
            />
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="settings-username">Username</FieldLabel>
            <Input
              id="settings-username"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              autoComplete="username"
              disabled={loading}
            />
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="settings-email">Email</FieldLabel>
            <Input id="settings-email" value={email ?? ""} readOnly disabled />
          </Field>

          <Field className="md:col-span-2">
            <FieldLabel>Custom categories</FieldLabel>
            <p className="text-sm text-parsel-muted">
              System categories stay locked. Custom names appear here after they are used on at least
              one transaction. Rename updates every matching row.
            </p>
            {categoryError ? <StatusAlert variant="error" title={categoryError} /> : null}
            {categoriesLoading ? (
              <p className="mt-2 text-sm text-parsel-muted">Loading categories…</p>
            ) : customCategories.length === 0 ? (
              <p className="mt-2 text-sm text-parsel-muted">
                No custom categories yet. Create one from the category dropdown when adding or editing
                a transaction, then save that transaction.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-parsel-border border border-parsel-border">
                {customCategories.map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm text-parsel-neutral">{item.name}</span>
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
                      aria-label={`Rename ${item.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <Field className="md:col-span-2">
            <FieldLabel htmlFor="settings-theme">Default theme</FieldLabel>
            <div className="flex items-center gap-2">
              <Sun
                className={cn(
                  "h-4 w-4",
                  form.theme !== "dark" ? "font-medium text-parsel-primary" : "text-parsel-muted",
                )}
                aria-hidden
              />
              <Switch
                id="settings-theme"
                checked={form.theme === "dark"}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, theme: checked ? "dark" : "light" }))
                }
                disabled={loading}
                aria-label="Default color theme"
              />
              <Moon
                className={cn(
                  "h-4 w-4",
                  form.theme === "dark" ? "font-medium text-parsel-primary" : "text-parsel-muted",
                )}
                aria-hidden
              />
              <span className="sr-only">{form.theme === "dark" ? "Dark mode" : "Light mode"}</span>
            </div>
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

      <Dialog open={Boolean(renaming)} onOpenChange={(next) => !next && setRenaming(null)}>
        <DialogContent className="max-w-md sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Rename category
            </DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="rename-category">Name</FieldLabel>
            <Input
              id="rename-category"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              maxLength={40}
              disabled={Boolean(categoryBusyName)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={Boolean(categoryBusyName)}
              onClick={() => void handleRename()}
            >
              {categoryBusyName ? "Saving…" : "Save name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
