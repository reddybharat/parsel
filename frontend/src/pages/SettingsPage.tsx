import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Moon, Pencil, Sun, Trash2 } from "lucide-react";

import { deleteCategory, renameCategory } from "@/api/tracker";
import { BanksManager } from "@/components/settings/BanksManager";
import { CategoryLimits } from "@/components/settings/CategoryLimits";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PASSWORD_HINT, passwordStrengthError } from "@/lib/password";
import { initialsFromProfile } from "@/lib/profile";
import {
  setTrackerConfigCategories,
  trackerConfigQueryOptions,
} from "@/lib/trackerConfigQuery";
import { useTheme, type Theme } from "@/lib/theme";
import type { Category } from "@/lib/types";

const MAX_CUSTOM_CATEGORIES = 10;
const DEFAULT_OPEN_SECTIONS: readonly SettingsSection[] = ["profile"];
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;
const USERNAME_HINT = "3–32 characters: letters, numbers, underscores. You sign in with this.";

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
  if (raw === "account") return "profile";
  return (SETTINGS_SECTIONS as readonly string[]).includes(raw)
    ? (raw as SettingsSection)
    : null;
}

function CollapsibleSection({
  id,
  title,
  summary,
  aside,
  open,
  onToggle,
  children,
}: {
  id: SettingsSection;
  title: string;
  summary: string;
  aside?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-3 border-b border-parsel-border last:border-b-0">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-6 py-3.5 text-left transition-colors hover:bg-parsel-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-parsel-primary md:px-8"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-parsel-neutral">{title}</span>
            <span className="mt-0.5 block text-xs font-normal text-parsel-muted">{summary}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3 text-xs font-normal text-parsel-muted">
            {aside}
            <ChevronDown
              className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
              aria-hidden
            />
          </span>
        </button>
      </h2>
      <div id={`${id}-panel`} hidden={!open} className="px-6 pb-6 pt-2 md:px-8">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  id,
  title,
  summary,
  children,
}: {
  id: SettingsSection;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-3 flex-wrap items-center justify-between gap-4 border-b border-parsel-border px-6 py-3.5 md:px-8"
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-parsel-neutral">{title}</h2>
        <p className="mt-0.5 text-xs text-parsel-muted">{summary}</p>
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const {
    username,
    email,
    firstName,
    lastName,
    updateProfile,
    changePassword,
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState<ReadonlySet<SettingsSection>>(
    () => new Set(DEFAULT_OPEN_SECTIONS),
  );

  const [nameForm, setNameForm] = useState({ firstName: "", lastName: "" });
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
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

  function toggleSection(section: SettingsSection) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (!next.delete(section)) next.add(section);
      return next;
    });
  }

  const initials = initialsFromProfile(firstName, lastName, username ?? email);
  const summaryName =
    [firstName, lastName].filter(Boolean).join(" ") || username || email || "Signed in";

  useEffect(() => {
    const section = parseSettingsSection(location.hash);
    if (!section) return;
    setOpenSections((prev) => new Set(prev).add(section));
    const frame = requestAnimationFrame(() => {
      const target = scrollRootRef.current?.querySelector(`#${section}`);
      if (target instanceof HTMLElement) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash]);

  useEffect(() => {
    setNameForm({ firstName: firstName ?? "", lastName: lastName ?? "" });
    setUsernameDraft(username ?? "");
  }, [firstName, lastName, username]);

  useEffect(() => {
    if (!categoriesFailed) return;
    setCategoryError(
      categoriesErr instanceof Error ? categoriesErr.message : "Could not load categories.",
    );
  }, [categoriesFailed, categoriesErr]);

  const profileDirty =
    nameForm.firstName.trim() !== (firstName ?? "") ||
    nameForm.lastName.trim() !== (lastName ?? "") ||
    usernameDraft.trim() !== (username ?? "");

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    const nextUsername = usernameDraft.trim();
    if (!USERNAME_PATTERN.test(nextUsername)) {
      setUsernameError(USERNAME_HINT);
      document.getElementById("settings-username")?.focus();
      return;
    }
    setUsernameError(null);
    setProfileSaving(true);
    setProfileFeedback(null);
    try {
      await updateProfile({
        first_name: nameForm.firstName.trim() || null,
        last_name: nameForm.lastName.trim() || null,
        username: nextUsername,
      });
      setProfileFeedback({ variant: "success", title: "Profile saved." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save profile.";
      if (/username/i.test(message)) {
        setUsernameError(message);
        document.getElementById("settings-username")?.focus();
      } else {
        setProfileFeedback({ variant: "error", title: message });
      }
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleThemeChange(next: Theme) {
    const previous = theme;
    setTheme(next);
    setProfileFeedback(null);
    try {
      await updateProfile({ preferences: { theme: next } });
    } catch (err) {
      setTheme(previous);
      setProfileFeedback({
        variant: "error",
        title: err instanceof Error ? err.message : "Could not save theme.",
      });
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
    <div className="flex h-full min-h-0 w-full justify-center bg-parsel-canvas">
      <div className="flex h-full min-h-0 w-full max-w-4xl flex-col rounded-none border-x border-parsel-border bg-parsel-surface shadow-none">
        <header className="shrink-0 border-b border-parsel-border px-6 py-3 md:px-8">
          <h1 className="text-base font-semibold tracking-wide">Settings</h1>
          <p className="text-xs text-parsel-muted">Manage your Parsel identity and ledger preferences.</p>
        </header>

        <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto">
          <CollapsibleSection
            id="profile"
            title="Profile"
            summary="Name, username and email."
            open={openSections.has("profile")}
            onToggle={() => toggleSection("profile")}
          >
            <form onSubmit={(e) => void handleSaveProfile(e)} noValidate>
              <div className="flex flex-wrap items-start gap-5">
                <Avatar className="mt-7 hidden h-14 w-14 shrink-0 rounded-none sm:flex border border-parsel-border" aria-hidden>
                  <AvatarFallback className="rounded-none bg-parsel-avatar-bg text-base font-semibold text-parsel-secondary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div id="account" className="grid min-w-0 flex-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:max-w-2xl">
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="settings-first-name">First name</FieldLabel>
                    <Input
                      id="settings-first-name"
                      value={nameForm.firstName}
                      onChange={(e) => setNameForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      disabled={profileSaving}
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="settings-last-name">Last name</FieldLabel>
                    <Input
                      id="settings-last-name"
                      value={nameForm.lastName}
                      onChange={(e) => setNameForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      disabled={profileSaving}
                      autoComplete="family-name"
                    />
                  </Field>
                  <Field className="gap-1.5" data-invalid={usernameError ? true : undefined}>
                    <FieldLabel htmlFor="settings-username">Username</FieldLabel>
                    <Input
                      id="settings-username"
                      value={usernameDraft}
                      onChange={(e) => {
                        setUsernameDraft(e.target.value);
                        setUsernameError(null);
                      }}
                      disabled={profileSaving}
                      autoComplete="username"
                      aria-invalid={usernameError ? true : undefined}
                      aria-describedby="settings-username-help"
                    />
                    {usernameError ? (
                      <FieldError id="settings-username-help" className="text-xs">{usernameError}</FieldError>
                    ) : (
                      <FieldDescription id="settings-username-help" className="text-xs">
                        {USERNAME_HINT}
                      </FieldDescription>
                    )}
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                    <Input
                      id="settings-email"
                      value={email ?? ""}
                      readOnly
                      aria-describedby="settings-email-help"
                      className="truncate bg-parsel-soft text-parsel-neutral"
                    />
                    <FieldDescription id="settings-email-help" className="text-xs">
                      Email can’t be changed.
                    </FieldDescription>
                  </Field>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button type="submit" className="w-fit" disabled={profileSaving || !profileDirty}>
                  {profileSaving ? "Saving…" : "Save profile"}
                </Button>
                <div role="status" aria-live="polite" className="min-h-5 text-xs">
                  {profileFeedback && (profileFeedback.variant === "error" || !profileDirty) ? (
                    <span className={profileFeedback.variant === "error" ? "text-destructive" : "text-parsel-muted"}>
                      {profileFeedback.title}
                    </span>
                  ) : profileDirty ? (
                    <span className="text-parsel-muted">Unsaved changes</span>
                  ) : null}
                </div>
              </div>
            </form>
          </CollapsibleSection>

          <SettingsRow
            id="appearance"
            title="Appearance"
            summary="Light or dark. Applies on every device you sign in on."
          >
            <ToggleGroup
              type="single"
              variant="outline"
              value={theme}
              onValueChange={(value) => {
                if (value === "light" || value === "dark") void handleThemeChange(value);
              }}
              aria-label="Theme"
              className="gap-0"
            >
              {(["light", "dark"] as const).map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  className="h-8 min-w-20 rounded-none px-3 text-xs shadow-none data-[state=on]:bg-parsel-nav-active-bg data-[state=on]:text-parsel-nav-active-text"
                >
                  {option === "light" ? <Sun aria-hidden /> : <Moon aria-hidden />}
                  {option === "light" ? "Light" : "Dark"}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SettingsRow>

          <SettingsRow id="password" title="Password" summary="Change the password used to sign in.">
            <Button type="button" variant="outline" className="w-fit" onClick={() => setPasswordDrawerOpen(true)}>
              Update password
            </Button>
          </SettingsRow>

          <CollapsibleSection
            id="banks"
            title="Banks"
            summary="Opening balances drive Net Portfolio Balance. Inactive banks hide when adding transactions."
            open={openSections.has("banks")}
            onToggle={() => toggleSection("banks")}
          >
            <BanksManager />
          </CollapsibleSection>

          <CollapsibleSection
            id="categories"
            title="Categories"
            summary="Monthly limits drive the Overview budget cards. Custom categories can be renamed or deleted."
            aside={`${customCategories.length}/${MAX_CUSTOM_CATEGORIES} custom`}
            open={openSections.has("categories")}
            onToggle={() => toggleSection("categories")}
          >
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
            ) : (
              <CategoryLimits
                categories={categories}
                rowActions={(item) =>
                  item.is_system === false ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Rename ${item.name}`}
                        title="Rename"
                        disabled={categoryBusyName === item.name}
                        onClick={() => {
                          setRenaming(item);
                          setRenameDraft(item.name);
                          setCategoryError(null);
                          setCategoryErrorLedgerName(null);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-parsel-danger-text hover:bg-parsel-danger-bg hover:text-parsel-danger-text"
                        aria-label={`Delete ${item.name}`}
                        title="Delete"
                        disabled={categoryBusyName === item.name}
                        onClick={() => {
                          setDeleting(item);
                          setCategoryError(null);
                          setCategoryErrorLedgerName(null);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : null
                }
              />
            )}
          </CollapsibleSection>
        </div>
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
            <Field className="gap-1.5">
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
            <Field className="gap-1.5">
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
            <Field className="gap-1.5">
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
            <Field className="gap-1.5">
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
