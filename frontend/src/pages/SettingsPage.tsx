import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Moon, Pencil, Sun, Trash2 } from "lucide-react";

import { deleteCategory, renameCategory } from "@/api/tracker";
import { BanksManager } from "@/components/settings/BanksManager";
import { StatusAlert, type FeedbackMessage } from "@/components/feedback/StatusAlert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { PASSWORD_HINT, passwordStrengthError } from "@/lib/password";
import {
  setTrackerConfigCategories,
  trackerConfigQueryOptions,
} from "@/lib/trackerConfigQuery";
import { useTheme, type Theme } from "@/lib/theme";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_CUSTOM_CATEGORIES = 10;

const PANEL_HEADER = "shrink-0 border-b border-parsel-border px-6 py-4";
const PANEL_TITLE = "text-sm font-semibold uppercase tracking-wide text-parsel-neutral";
const PANEL_SUBTITLE = "mt-1 text-xs text-parsel-muted";
const PANEL_BODY = "min-h-0 flex-1 overflow-y-auto p-6 md:p-8";
const PANEL_FOOTER =
  "shrink-0 flex items-center justify-end gap-2 border-t border-parsel-border bg-parsel-soft/40 px-6 py-3";

function SettingsSection({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col bg-parsel-surface", className)}>
      <header className={PANEL_HEADER}>
        <h2 className={PANEL_TITLE}>{title}</h2>
        <p className={PANEL_SUBTITLE}>{description}</p>
      </header>
      <div className={PANEL_BODY}>{children}</div>
      {footer ? <div className={PANEL_FOOTER}>{footer}</div> : null}
    </section>
  );
}

export function SettingsPage() {
  const {
    username,
    email,
    firstName,
    lastName,
    preferences,
    updateProfile,
    changePassword,
    logout,
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", username: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<FeedbackMessage | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackMessage | null>(null);

  const [defaultTheme, setDefaultTheme] = useState<Theme>("light");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeFeedback, setThemeFeedback] = useState<FeedbackMessage | null>(null);

  const {
    data: trackerConfig,
    isPending: categoriesLoading,
    isError: categoriesFailed,
    error: categoriesErr,
  } = useQuery(trackerConfigQueryOptions());
  const categories = trackerConfig?.categories ?? [];
  const customCategories = categories.filter((item) => item.is_system === false);

  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryErrorLedgerName, setCategoryErrorLedgerName] = useState<string | null>(null);
  const [categoryBusyName, setCategoryBusyName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    setProfileForm({
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      username: username ?? "",
    });
  }, [firstName, lastName, username]);

  useEffect(() => {
    setDefaultTheme(preferences?.theme ?? theme);
  }, [preferences, theme]);

  useEffect(() => {
    if (!categoriesFailed) return;
    setCategoryError(
      categoriesErr instanceof Error ? categoriesErr.message : "Could not load categories.",
    );
  }, [categoriesFailed, categoriesErr]);

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileFeedback(null);
    try {
      await updateProfile({
        username: profileForm.username.trim(),
        first_name: profileForm.firstName.trim() || null,
        last_name: profileForm.lastName.trim() || null,
      });
      setProfileFeedback({ variant: "success", title: "Profile updated." });
    } catch (err) {
      setProfileFeedback({
        variant: "error",
        title: err instanceof Error ? err.message : "Could not save profile.",
      });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveTheme() {
    setThemeSaving(true);
    setThemeFeedback(null);
    try {
      await updateProfile({ preferences: { theme: defaultTheme } });
      setTheme(defaultTheme);
      setThemeFeedback({ variant: "success", title: "Default theme updated." });
    } catch (err) {
      setThemeFeedback({
        variant: "error",
        title: err instanceof Error ? err.message : "Could not save default theme.",
      });
    } finally {
      setThemeSaving(false);
    }
  }

  async function handleChangePassword() {
    setPasswordFeedback(null);
    const strengthError = passwordStrengthError(passwordForm.newPassword);
    if (strengthError) {
      setPasswordFeedback({ variant: "error", title: strengthError });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ variant: "error", title: "Passwords do not match." });
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordFeedback({
        variant: "error",
        title: "New password must be different from the current password.",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
        confirm_password: passwordForm.confirmPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordFeedback({ variant: "success", title: "Password updated." });
    } catch (err) {
      setPasswordFeedback({
        variant: "error",
        title: err instanceof Error ? err.message : "Could not change password.",
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleRename() {
    if (!renaming) return;
    const name = renameDraft.trim().replace(/\s+/g, " ");
    if (!name) {
      setCategoryError("Please enter a category name.");
      setCategoryErrorLedgerName(null);
      return;
    }
    setCategoryBusyName(renaming.name);
    setCategoryError(null);
    setCategoryErrorLedgerName(null);
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
      setCategoryErrorLedgerName(null);
    } finally {
      setCategoryBusyName(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const targetName = deleting.name;
    setCategoryBusyName(targetName);
    setCategoryError(null);
    setCategoryErrorLedgerName(null);
    try {
      await deleteCategory(targetName);
      const next = categories.filter(
        (item) => item.name.toLocaleLowerCase() !== targetName.toLocaleLowerCase(),
      );
      setTrackerConfigCategories(next);
      setDeleting(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete category.";
      setCategoryError(message);
      setCategoryErrorLedgerName(
        /is used by \d+ transactions?/i.test(message) ? targetName : null,
      );
      setDeleting(null);
    } finally {
      setCategoryBusyName(null);
    }
  }

  async function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto border border-parsel-border lg:grid lg:grid-cols-6 lg:auto-rows-min">
        <SettingsSection
          className="border-b border-parsel-border lg:col-span-4 lg:border-r"
          title="Profile"
          description="Your name and sign-in details."
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="mr-auto gap-2 border-parsel-border text-parsel-muted shadow-none hover:border-parsel-danger/40 hover:bg-parsel-danger-bg hover:text-parsel-danger-text"
                onClick={handleLogout}
                disabled={profileSaving}
              >
                <LogOut className="size-4" aria-hidden />
                Log out
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </Button>
            </>
          }
        >
          {profileFeedback ? (
            <div className="mb-4">
              <StatusAlert
                variant={profileFeedback.variant}
                title={profileFeedback.title}
                onDismiss={() => setProfileFeedback(null)}
              />
            </div>
          ) : null}
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="settings-first-name">First name</FieldLabel>
              <Input
                id="settings-first-name"
                value={profileForm.firstName}
                onChange={(e) =>
                  setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
                disabled={profileSaving}
                autoComplete="given-name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-last-name">Last name</FieldLabel>
              <Input
                id="settings-last-name"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                disabled={profileSaving}
                autoComplete="family-name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-username">Username</FieldLabel>
              <Input
                id="settings-username"
                value={profileForm.username}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                disabled={profileSaving}
                autoComplete="username"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-email">Email</FieldLabel>
              <Input id="settings-email" value={email ?? ""} disabled readOnly />
              <FieldDescription>Email cannot be changed.</FieldDescription>
            </Field>
          </FieldGroup>
        </SettingsSection>

        <SettingsSection
          className="border-b border-parsel-border lg:col-span-2"
          title="Appearance"
          description="The theme applied when you sign in on a new device."
          footer={
            <Button type="button" onClick={() => void handleSaveTheme()} disabled={themeSaving}>
              {themeSaving ? "Saving…" : "Save default"}
            </Button>
          }
        >
          {themeFeedback ? (
            <div className="mb-4">
              <StatusAlert
                variant={themeFeedback.variant}
                title={themeFeedback.title}
                onDismiss={() => setThemeFeedback(null)}
              />
            </div>
          ) : null}
          <Field>
            <FieldLabel>Default theme</FieldLabel>
            <div className="flex items-center gap-3 border border-parsel-border bg-parsel-soft px-3 py-2">
              <Sun className="size-4 text-parsel-muted" aria-hidden />
              <Switch
                checked={defaultTheme === "dark"}
                onCheckedChange={(checked) => setDefaultTheme(checked ? "dark" : "light")}
                disabled={themeSaving}
                aria-label="Default dark mode"
              />
              <Moon className="size-4 text-parsel-muted" aria-hidden />
              <span className="text-sm text-parsel-muted">
                {defaultTheme === "dark" ? "Dark" : "Light"}
              </span>
            </div>
          </Field>
        </SettingsSection>

        <SettingsSection
          className="border-b border-parsel-border lg:col-span-6"
          title="Banks"
          description="Banks on your profile. Opening balances drive your Net Portfolio Balance; inactive banks stay in your history but are hidden when adding transactions."
        >
          <BanksManager />
        </SettingsSection>

        <SettingsSection
          className="border-b border-parsel-border lg:col-span-3 lg:border-b-0 lg:border-r"
          title="Custom categories"
          description={`Saved to your account. Up to ${MAX_CUSTOM_CATEGORIES} custom categories.`}
        >
          <div className="mb-3 flex justify-end">
            <span className="text-xs text-parsel-muted">
              {customCategories.length}/{MAX_CUSTOM_CATEGORIES}
            </span>
          </div>
          {categoryError ? (
            <div className="mb-3">
              <StatusAlert
                variant="error"
                title={categoryError}
                action={
                  categoryErrorLedgerName ? (
                    <Button asChild size="sm" variant="outline" className="rounded-none shadow-none">
                      <Link
                        to={`/ledger/search?category=${encodeURIComponent(categoryErrorLedgerName)}`}
                      >
                        Go to ledger
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : null}
          {categoriesLoading ? (
            <p className="text-sm text-parsel-muted">Loading categories…</p>
          ) : customCategories.length === 0 ? (
            <p className="text-sm text-parsel-muted">
              No custom categories yet. Create one when adding a transaction.
            </p>
          ) : (
            <ul className="divide-y divide-parsel-border border border-parsel-border">
              {customCategories.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-parsel-neutral" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={categoryBusyName === item.name}
                      onClick={() => {
                        setRenaming(item);
                        setRenameDraft(item.name);
                        setCategoryError(null);
                        setCategoryErrorLedgerName(null);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-parsel-danger-text hover:bg-parsel-danger-bg hover:text-parsel-danger-text"
                      disabled={categoryBusyName === item.name}
                      onClick={() => {
                        setDeleting(item);
                        setCategoryError(null);
                        setCategoryErrorLedgerName(null);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>

        <SettingsSection
          className="lg:col-span-3"
          title="Password"
          description="Change the password used to sign in."
          footer={
            <Button
              type="button"
              onClick={() => void handleChangePassword()}
              disabled={
                passwordSaving ||
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
            >
              {passwordSaving ? "Updating…" : "Update password"}
            </Button>
          }
        >
          {passwordFeedback ? (
            <div className="mb-4">
              <StatusAlert
                variant={passwordFeedback.variant}
                title={passwordFeedback.title}
                onDismiss={() => setPasswordFeedback(null)}
              />
            </div>
          ) : null}
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
              <FieldLabel htmlFor="settings-current-password">Current password</FieldLabel>
              <Input
                id="settings-current-password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                }
                disabled={passwordSaving}
                autoComplete="current-password"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-new-password">New password</FieldLabel>
              <Input
                id="settings-new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                disabled={passwordSaving}
                autoComplete="new-password"
              />
              <FieldDescription>{PASSWORD_HINT}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-confirm-password">Confirm new password</FieldLabel>
              <Input
                id="settings-confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
                disabled={passwordSaving}
                autoComplete="new-password"
              />
            </Field>
          </FieldGroup>
        </SettingsSection>
      </div>

      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(next) => !categoryBusyName && !next && setRenaming(null)}
      >
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
            <Button
              type="button"
              disabled={Boolean(categoryBusyName)}
              onClick={() => void handleRename()}
            >
              {categoryBusyName ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(next) => !categoryBusyName && !next && setDeleting(null)}
      >
        <DialogContent className="max-w-md sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Delete category
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-parsel-muted">
            Delete <span className="font-semibold text-parsel-neutral">{deleting?.name}</span>?
            This is only allowed when no transactions use this category.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={Boolean(categoryBusyName)}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(categoryBusyName)}
              onClick={() => void handleDelete()}
            >
              {categoryBusyName ? "Deleting…" : "Delete category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
