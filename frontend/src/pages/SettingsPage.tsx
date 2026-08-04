import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Moon, Pencil, Sun, Trash2 } from "lucide-react";

import { deleteCategory, renameCategory } from "@/api/tracker";
import { BanksManager } from "@/components/settings/BanksManager";
import { StatusAlert, type FeedbackMessage } from "@/components/feedback/StatusAlert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { PASSWORD_HINT, passwordStrengthError } from "@/lib/password";
import { initialsFromProfile } from "@/lib/profile";
import {
  setTrackerConfigCategories,
  trackerConfigQueryOptions,
} from "@/lib/trackerConfigQuery";
import { useTheme, type Theme } from "@/lib/theme";
import type { Category } from "@/lib/types";

const MAX_CUSTOM_CATEGORIES = 10;

const SETTINGS_SECTIONS = [
  "profile",
  "appearance",
  "account",
  "password",
  "banks",
  "categories",
] as const;
type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

function parseSettingsSection(hash: string): SettingsSection | null {
  const raw = hash.replace(/^#/, "").toLowerCase();
  if (raw === "other") return "banks";
  return (SETTINGS_SECTIONS as readonly string[]).includes(raw)
    ? (raw as SettingsSection)
    : null;
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-parsel-border bg-parsel-surface">
      <header className="border-b border-parsel-border px-4 py-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-parsel-neutral">{title}</h2>
        <p className="mt-0.5 text-xs text-parsel-muted">{description}</p>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SettingsCell({
  id,
  title,
  description,
  children,
}: {
  id: SettingsSection;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-3 border border-parsel-border p-3">
      <div className="mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-parsel-neutral">{title}</h3>
        <p className="mt-0.5 text-xs text-parsel-muted">{description}</p>
      </div>
      {children}
    </div>
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
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const [nameForm, setNameForm] = useState({ firstName: "", lastName: "" });
  const [usernameDraft, setUsernameDraft] = useState("");
  const [defaultTheme, setDefaultTheme] = useState<Theme>("light");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<FeedbackMessage | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackMessage | null>(null);
  const [passwordDrawerOpen, setPasswordDrawerOpen] = useState(false);

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

  const initials = initialsFromProfile(firstName, lastName, username ?? email);
  const summaryName =
    [firstName, lastName].filter(Boolean).join(" ") || username || email || "Signed in";

  useEffect(() => {
    const section = parseSettingsSection(location.hash);
    if (!section) return;
    const root = scrollRootRef.current;
    const target = root?.querySelector(`#${section}`);
    if (!(target instanceof HTMLElement) || !root) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  useEffect(() => {
    setNameForm({ firstName: firstName ?? "", lastName: lastName ?? "" });
    setUsernameDraft(username ?? "");
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
        first_name: nameForm.firstName.trim() || null,
        last_name: nameForm.lastName.trim() || null,
        username: usernameDraft.trim(),
        preferences: { theme: defaultTheme },
      });
      setTheme(defaultTheme);
      setProfileFeedback({ variant: "success", title: "Profile saved." });
    } catch (err) {
      setProfileFeedback({
        variant: "error",
        title: err instanceof Error ? err.message : "Could not save profile.",
      });
    } finally {
      setProfileSaving(false);
    }
  }

  function resetPasswordForm() {
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordFeedback(null);
  }

  function handlePasswordDrawerOpenChange(next: boolean) {
    if (passwordSaving) return;
    if (!next) resetPasswordForm();
    setPasswordDrawerOpen(next);
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
      resetPasswordForm();
      setPasswordDrawerOpen(false);
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mb-3 shrink-0">
        <h1 className="text-base font-semibold tracking-wide">Settings</h1>
        <p className="text-xs text-parsel-muted">Manage your Parsel identity and ledger preferences.</p>
      </div>

      <div ref={scrollRootRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-4">
        <SettingsGroup title="Profile" description="Identity, sign-in, and appearance.">
          {profileFeedback ? (
            <div className="mb-3">
              <StatusAlert
                variant={profileFeedback.variant}
                title={profileFeedback.title}
                onDismiss={() => setProfileFeedback(null)}
              />
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            <SettingsCell
              id="profile"
              title="Profile"
              description="Your display name."
            >
              <div className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-[5.5rem] max-w-[8rem] shrink-0 flex-col items-center gap-1">
                  <Avatar className="h-12 w-12 rounded-none border border-parsel-border" aria-hidden>
                    <AvatarFallback className="rounded-none bg-parsel-avatar-bg text-sm font-semibold text-parsel-secondary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <p className="w-full truncate text-center text-xs text-parsel-muted" title={summaryName}>
                    {summaryName}
                  </p>
                </div>
                <div className="grid w-full max-w-sm grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel htmlFor="settings-first-name">First name</FieldLabel>
                    <Input
                      id="settings-first-name"
                      value={nameForm.firstName}
                      onChange={(e) =>
                        setNameForm((prev) => ({ ...prev, firstName: e.target.value }))
                      }
                      disabled={profileSaving}
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="settings-last-name">Last name</FieldLabel>
                    <Input
                      id="settings-last-name"
                      value={nameForm.lastName}
                      onChange={(e) =>
                        setNameForm((prev) => ({ ...prev, lastName: e.target.value }))
                      }
                      disabled={profileSaving}
                      autoComplete="family-name"
                    />
                  </Field>
                </div>
              </div>
            </SettingsCell>

            <SettingsCell
              id="account"
              title="Account"
              description="Username and email for this Parsel login."
            >
              <div className="grid w-full max-w-sm grid-cols-2 gap-2">
                <Field>
                  <FieldLabel htmlFor="settings-username">Username</FieldLabel>
                  <Input
                    id="settings-username"
                    value={usernameDraft}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    disabled={profileSaving}
                    autoComplete="username"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block w-full cursor-default">
                          <Input
                            id="settings-email"
                            className="pointer-events-none"
                            value={email ?? ""}
                            disabled
                            readOnly
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Email cannot be changed.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Field>
              </div>
            </SettingsCell>

            <SettingsCell
              id="appearance"
              title="Appearance"
              description="Default theme for new devices."
            >
              <div className="flex w-fit items-center gap-2 border border-parsel-border bg-parsel-soft px-2 py-1.5">
                  <span className="flex items-center gap-1 text-[11px] text-parsel-muted">
                    <Sun className="size-3 shrink-0" aria-hidden />
                    Light
                  </span>
                  <Switch
                    checked={defaultTheme === "dark"}
                    onCheckedChange={(checked) => setDefaultTheme(checked ? "dark" : "light")}
                    disabled={profileSaving}
                    aria-label="Default dark mode"
                    className="h-3.5 w-6 [&>span]:h-2.5 [&>span]:w-2.5 [&>span]:data-[state=checked]:translate-x-2.5 [&>span]:data-[state=unchecked]:translate-x-0"
                  />
                  <span className="flex items-center gap-1 text-[11px] text-parsel-muted">
                    <Moon className="size-3 shrink-0" aria-hidden />
                    Dark
                  </span>
                </div>
            </SettingsCell>

            <SettingsCell
              id="password"
              title="Password"
              description="Change the password used to sign in."
            >
              <Button type="button" className="w-fit" onClick={() => setPasswordDrawerOpen(true)}>
                Update password
              </Button>
            </SettingsCell>
          </div>
          <div className="mt-4 flex justify-start border-t border-parsel-border pt-4">
            <Button
              type="button"
              className="w-fit"
              onClick={() => void handleSaveProfile()}
              disabled={profileSaving}
            >
              {profileSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </SettingsGroup>

        <SettingsGroup title="Other" description="Ledger preferences.">
          <div className="grid gap-3 lg:grid-cols-2">
            <SettingsCell
              id="banks"
              title="Banks"
              description="Opening balances drive Net Portfolio Balance. Inactive banks stay in history but hide when adding transactions."
            >
              <BanksManager />
            </SettingsCell>

            <SettingsCell
              id="categories"
              title="Categories"
              description={`Custom categories on your account. Up to ${MAX_CUSTOM_CATEGORIES}.`}
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
                <ul className="max-w-md divide-y divide-parsel-border border border-parsel-border">
                  {customCategories.map((item) => (
                    <li key={item.name} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className="min-w-0 truncate text-sm text-parsel-neutral" title={item.name}>
                        {item.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-0.5">
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
            </SettingsCell>
          </div>
        </SettingsGroup>
      </div>

      <Drawer open={passwordDrawerOpen} onOpenChange={handlePasswordDrawerOpenChange}>
        <DrawerContent className="sm:max-w-md" showCloseButton={!passwordSaving}>
          <DrawerHeader>
            <DrawerTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Update password
            </DrawerTitle>
          </DrawerHeader>
          {passwordFeedback ? (
            <div className="shrink-0">
              <StatusAlert
                variant={passwordFeedback.variant}
                title={passwordFeedback.title}
                onDismiss={() => setPasswordFeedback(null)}
              />
            </div>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <Field>
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
          </div>
          <DrawerFooter className="shrink-0">
            <Button
              type="button"
              variant="ghost"
              disabled={passwordSaving}
              onClick={() => handlePasswordDrawerOpenChange(false)}
            >
              Cancel
            </Button>
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
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(renaming)}
        onOpenChange={(next) => !categoryBusyName && !next && setRenaming(null)}
      >
        <DrawerContent className="sm:max-w-md" showCloseButton={!categoryBusyName}>
          <DrawerHeader>
            <DrawerTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Rename category
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
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
          </div>
          <DrawerFooter className="shrink-0">
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
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(deleting)}
        onOpenChange={(next) => !categoryBusyName && !next && setDeleting(null)}
      >
        <DrawerContent className="sm:max-w-md" showCloseButton={!categoryBusyName}>
          <DrawerHeader>
            <DrawerTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Delete category
            </DrawerTitle>
          </DrawerHeader>
          <p className="text-sm leading-relaxed text-parsel-muted">
            Delete <span className="font-semibold text-parsel-neutral">{deleting?.name}</span>?
            This is only allowed when no transactions use this category.
          </p>
          <DrawerFooter className="shrink-0">
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
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
