import { Moon, Pencil, Sun, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function Shell({
  id,
  label,
  blurb,
  children,
}: {
  id: string;
  label: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <article id={id} className="scroll-mt-3 space-y-1.5 border border-parsel-border bg-parsel-canvas p-3">
      <header className="mb-2 border-b border-parsel-border pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-parsel-primary">{label}</h2>
        <p className="mt-0.5 text-xs text-parsel-muted">{blurb}</p>
      </header>
      {children}
    </article>
  );
}

function Group({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-parsel-border bg-parsel-surface", className)}>
      <header className="border-b border-parsel-border px-4 py-2.5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-parsel-neutral">{title}</h3>
        <p className="mt-0.5 text-xs text-parsel-muted">{description}</p>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TypeTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 inline-block border border-parsel-border bg-parsel-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-parsel-muted">
      {children}
    </span>
  );
}

function SubHead({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-parsel-neutral">{title}</h4>
      <p className="mt-0.5 text-xs text-parsel-muted">{description}</p>
    </div>
  );
}

/** Profile type — avatar + inline name pair, narrow. */
function LayoutProfile() {
  return (
    <div>
      <TypeTag>Layout · avatar + paired fields</TypeTag>
      <SubHead title="Profile" description="Display name." />
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className="h-12 w-12 shrink-0 rounded-none border border-parsel-border" aria-hidden>
          <AvatarFallback className="rounded-none bg-parsel-avatar-bg text-sm font-semibold text-parsel-secondary">
            AL
          </AvatarFallback>
        </Avatar>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel>First name</FieldLabel>
              <Input defaultValue="Ada" disabled />
            </Field>
            <Field>
              <FieldLabel>Last name</FieldLabel>
              <Input defaultValue="Lovelace" disabled />
            </Field>
          </div>
          <Button type="button" className="w-fit" disabled>
            Save name
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Appearance type — single horizontal control strip. */
function LayoutAppearance() {
  return (
    <div>
      <TypeTag>Layout · inline strip</TypeTag>
      <SubHead title="Appearance" description="Default theme for new devices." />
      <div className="flex w-full max-w-md flex-wrap items-center gap-3">
        <div className="flex min-w-[14rem] flex-1 items-center justify-between gap-2 border border-parsel-border bg-parsel-soft px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-parsel-muted">
            <Sun className="size-3.5 shrink-0" aria-hidden />
            Light
          </span>
          <Switch checked={false} disabled aria-label="Default dark mode" />
          <span className="flex items-center gap-1.5 text-xs text-parsel-muted">
            <Moon className="size-3.5 shrink-0" aria-hidden />
            Dark
          </span>
        </div>
        <Button type="button" className="w-fit shrink-0" disabled>
          Save default
        </Button>
      </div>
    </div>
  );
}

/** Account type — stacked narrow fields, left rail. */
function LayoutAccount() {
  return (
    <div>
      <TypeTag>Layout · stacked rail</TypeTag>
      <SubHead title="Account" description="Username and email." />
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Field>
          <FieldLabel>Username</FieldLabel>
          <Input defaultValue="ada" disabled />
        </Field>
        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input defaultValue="ada@example.com" disabled />
          <FieldDescription>Email cannot be changed.</FieldDescription>
        </Field>
        <Button type="button" className="w-fit" disabled>
          Save username
        </Button>
      </div>
    </div>
  );
}

/** Password type — denser 2-up for new/confirm, single current above. */
function LayoutPassword() {
  return (
    <div>
      <TypeTag>Layout · current + 2-up</TypeTag>
      <SubHead title="Password" description="Change the password used to sign in." />
      <div className="flex w-full max-w-md flex-col gap-3">
        <Field className="max-w-xs">
          <FieldLabel>Current password</FieldLabel>
          <Input type="password" defaultValue="••••••••" disabled />
        </Field>
        <div className="grid max-w-md grid-cols-2 gap-2">
          <Field>
            <FieldLabel>New password</FieldLabel>
            <Input type="password" defaultValue="••••••••" disabled />
          </Field>
          <Field>
            <FieldLabel>Confirm</FieldLabel>
            <Input type="password" defaultValue="••••••••" disabled />
          </Field>
        </div>
        <Button type="button" className="w-fit" disabled>
          Update password
        </Button>
      </div>
    </div>
  );
}

/** Banks type — wide tabular list. */
function LayoutBanks() {
  return (
    <div>
      <TypeTag>Layout · table list</TypeTag>
      <SubHead title="Banks" description="Opening balances and visibility." />
      <div className="border border-parsel-border">
        <div className="grid grid-cols-[1fr_7rem_5rem] gap-2 border-b border-parsel-border bg-parsel-soft px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-parsel-muted">
          <span>Bank</span>
          <span>Opening</span>
          <span>Status</span>
        </div>
        {[
          ["SBI", "₹12,000", "Active"],
          ["Kotak", "₹8,450", "Active"],
          ["Slice", "₹1,200", "Inactive"],
        ].map(([bank, opening, status]) => (
          <div
            key={bank}
            className="grid grid-cols-[1fr_7rem_5rem] gap-2 border-b border-parsel-border px-3 py-2 text-sm last:border-b-0"
          >
            <span className="font-medium">{bank}</span>
            <span className="text-parsel-muted">{opening}</span>
            <span className="text-xs text-parsel-muted">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Categories type — compact rename/delete rows, narrower. */
function LayoutCategories() {
  return (
    <div>
      <TypeTag>Layout · action rows</TypeTag>
      <SubHead title="Categories" description="Custom categories (up to 10)." />
      <ul className="max-w-md divide-y divide-parsel-border border border-parsel-border">
        {["Groceries", "Travel", "Subscriptions"].map((name) => (
          <li key={name} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="truncate text-sm text-parsel-neutral">{name}</span>
            <div className="flex shrink-0 gap-0.5">
              <Button type="button" variant="ghost" size="sm" disabled>
                <Pencil className="size-3.5" />
                Rename
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-parsel-danger-text"
                disabled
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Look A — 2×2 shells; each cell keeps its type-specific layout. */
function LookA() {
  return (
    <Shell
      id="look-a"
      label="Look A · 2×2 + type layouts"
      blurb="Profile uses four tiles. Each tile keeps its own field pattern (paired / strip / rail / 2-up)."
    >
      <Group title="Profile" description="Identity, sign-in, and appearance.">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="border border-parsel-border p-3">
            <LayoutProfile />
          </div>
          <div className="border border-parsel-border p-3">
            <LayoutAppearance />
          </div>
          <div className="border border-parsel-border p-3">
            <LayoutAccount />
          </div>
          <div className="border border-parsel-border p-3">
            <LayoutPassword />
          </div>
        </div>
      </Group>
      <Group title="Other" description="Ledger preferences.">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="border border-parsel-border p-3">
            <LayoutBanks />
          </div>
          <div className="border border-parsel-border p-3">
            <LayoutCategories />
          </div>
        </div>
      </Group>
    </Shell>
  );
}

/** Look B — two columns of type layouts without nested cell borders. */
function LookB() {
  return (
    <Shell
      id="look-b"
      label="Look B · two columns + type layouts"
      blurb="Same type layouts, open columns. Other: table banks vs action-row categories."
    >
      <Group title="Profile" description="Identity, sign-in, and appearance.">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            <LayoutProfile />
            <LayoutAccount />
          </div>
          <div className="space-y-8">
            <LayoutAppearance />
            <LayoutPassword />
          </div>
        </div>
      </Group>
      <Group title="Other" description="Ledger preferences.">
        <div className="grid gap-8 lg:grid-cols-2">
          <LayoutBanks />
          <LayoutCategories />
        </div>
      </Group>
    </Shell>
  );
}

/** Look C — stacked Profile rail; Other splits with a vertical rule. */
function LookC() {
  return (
    <Shell
      id="look-c"
      label="Look C · stacked rail + type layouts"
      blurb="One Profile surface; section types stack with dividers. Other stays split."
    >
      <Group title="Profile" description="Identity, sign-in, and appearance.">
        <div className="divide-y divide-parsel-border">
          {[LayoutProfile, LayoutAppearance, LayoutAccount, LayoutPassword].map((Block, i) => (
            <div key={Block.name} className={cn(i === 0 ? "pb-5" : "py-5")}>
              <Block />
            </div>
          ))}
        </div>
      </Group>
      <Group title="Other" description="Ledger preferences.">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-0">
          <div className="lg:border-r lg:border-parsel-border lg:pr-6">
            <LayoutBanks />
          </div>
          <div className="lg:pl-6">
            <LayoutCategories />
          </div>
        </div>
      </Group>
    </Shell>
  );
}

/** Look D — four strips across; types keep their distinctive layouts at a tighter width. */
function LookD() {
  return (
    <Shell
      id="look-d"
      label="Look D · four strips + type layouts"
      blurb="Wide Profile row: each type owns a column. Other: banks full-bleed table under categories rail."
    >
      <Group title="Profile" description="Identity, sign-in, and appearance.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <LayoutProfile />
          <LayoutAppearance />
          <LayoutAccount />
          <LayoutPassword />
        </div>
      </Group>
      <Group title="Other" description="Ledger preferences.">
        <div className="space-y-6">
          <LayoutBanks />
          <LayoutCategories />
        </div>
      </Group>
    </Shell>
  );
}

/** Look E — catalog: each type alone at full clarity (reference sheet). */
function LookE() {
  return (
    <Shell
      id="look-e"
      label="Look E · type catalog"
      blurb="Reference sheet — Profile container then Other, each type labeled with its layout pattern only."
    >
      <Group title="Profile" description="Four identity types, each with its own layout language.">
        <div className="space-y-6">
          <LayoutProfile />
          <LayoutAppearance />
          <LayoutAccount />
          <LayoutPassword />
        </div>
      </Group>
      <Group title="Other" description="Two ledger types with different row treatments.">
        <div className="space-y-6">
          <LayoutBanks />
          <LayoutCategories />
        </div>
      </Group>
    </Shell>
  );
}

const LOOKS = [
  { id: "look-a", label: "A · 2×2" },
  { id: "look-b", label: "B · columns" },
  { id: "look-c", label: "C · stacked" },
  { id: "look-d", label: "D · strips" },
  { id: "look-e", label: "E · catalog" },
] as const;

export function SettingsLayoutsPage() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mb-3 shrink-0 space-y-2">
        <div>
          <h1 className="text-base font-semibold tracking-wide">Settings layout lab</h1>
          <p className="text-xs text-parsel-muted">
            Dummy — Profile + Other containers. Each section type has a distinct layout (paired fields,
            inline strip, stacked rail, 2-up password, bank table, category actions). Shell A–D only
            change how those types are arranged. Real forms:{" "}
            <a href="/settings/live" className="text-parsel-primary underline-offset-2 hover:underline">
              /settings/live
            </a>
            .
          </p>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="Jump to look">
          {LOOKS.map((look) => (
            <a
              key={look.id}
              href={`#${look.id}`}
              className="border border-parsel-border bg-parsel-surface px-2.5 py-1 text-xs text-parsel-muted transition hover:border-parsel-primary hover:text-parsel-text"
            >
              {look.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-6">
        <LookA />
        <LookB />
        <LookC />
        <LookD />
        <LookE />
      </div>
    </div>
  );
}
