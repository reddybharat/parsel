import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

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
import { useTheme, type Theme } from "@/lib/theme";
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

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      username: username ?? "",
      theme: preferences?.theme ?? theme,
    });
  }, [open, firstName, lastName, username, preferences, theme]);

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

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="max-w-xl sm:rounded-xl">
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
  );
}
