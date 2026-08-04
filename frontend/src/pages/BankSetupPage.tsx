import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, Plus } from "lucide-react";

import { createBank, fetchBankSetup } from "@/api/tracker";
import { ParselMark } from "@/components/brand/ParselMark";
import { StatusAlert } from "@/components/feedback/StatusAlert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { banksQueryOptions, setProfileBanks } from "@/lib/banksQuery";
import { currentMonthValue, formatMonthValueLabel } from "@/lib/dashboardQuery";
import { formatInrAmount } from "@/lib/format";
import type { ProfileBank } from "@/lib/types";

export function BankSetupPage() {
  const navigate = useNavigate();
  const { data: setup } = useQuery({
    queryKey: ["banks", "setup"],
    queryFn: fetchBankSetup,
    staleTime: 60_000,
  });
  const { data: banks = [] } = useQuery(banksQueryOptions());

  const catalog = setup?.catalog ?? [];
  const suggested = setup?.suggested_banks ?? [];
  const addedNames = useMemo(() => new Set(banks.map((b) => b.bank)), [banks]);
  const available = catalog.filter((name) => !addedNames.has(name));

  const [form, setForm] = useState({
    bank: "",
    opening_balance: "",
    opening_month: currentMonthValue(),
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the bank select pointed at a still-available option.
  const selectedBank = form.bank && available.includes(form.bank) ? form.bank : available[0] ?? "";

  async function handleAdd() {
    const balance = Number(form.opening_balance);
    if (!selectedBank) {
      setError("Please select a bank.");
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      setError("Opening balance must be zero or more.");
      return;
    }
    if (!form.opening_month) {
      setError("Please choose an opening month.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created: ProfileBank = await createBank({
        bank: selectedBank,
        opening_balance: balance,
        opening_month: form.opening_month,
      });
      setProfileBanks([...banks, created]);
      setForm({ bank: "", opening_balance: "", opening_month: currentMonthValue() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add bank.");
    } finally {
      setBusy(false);
    }
  }

  const canContinue = banks.some((b) => b.is_active);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-parsel-soft p-4">
      <div className="w-full max-w-lg border border-parsel-border bg-parsel-surface">
        <header className="border-b border-parsel-border px-6 py-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-parsel-primary">
            <ParselMark fit="fitted" className="h-3 w-3.5" />
            Set up your banks
          </p>
          <h1 className="mt-2 text-lg font-semibold text-parsel-neutral">
            Add each bank and its opening balance
          </h1>
          <p className="mt-1 text-sm text-parsel-muted">
            Your Net Portfolio Balance is built from these opening balances plus your
            transactions. Add at least one bank to continue.
          </p>
        </header>

        <div className="space-y-5 px-6 py-6">
          {suggested.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-parsel-secondary">
                Found in your transactions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggested
                  .filter((name) => !addedNames.has(name))
                  .map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="border border-parsel-border px-3 py-1 text-xs text-parsel-neutral hover:border-parsel-primary hover:text-parsel-primary"
                      onClick={() => setForm((prev) => ({ ...prev, bank: name }))}
                    >
                      {name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {banks.length > 0 && (
            <ul className="divide-y divide-parsel-border border border-parsel-border">
              {banks.map((bank) => (
                <li key={bank.bank} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-parsel-neutral">{bank.bank}</p>
                    <p className="text-xs text-parsel-muted">
                      {formatInrAmount(bank.opening_balance)} as of{" "}
                      {formatMonthValueLabel(bank.opening_month)}
                    </p>
                  </div>
                  <Check className="size-4 shrink-0 text-parsel-inflow" aria-hidden />
                </li>
              ))}
            </ul>
          )}

          {available.length > 0 ? (
            <div className="space-y-3 border border-parsel-border bg-parsel-soft/40 p-4">
              <Field>
                <FieldLabel htmlFor="setup-bank">Bank</FieldLabel>
                <NativeSelect
                  id="setup-bank"
                  value={selectedBank}
                  onChange={(e) => setForm((prev) => ({ ...prev, bank: e.target.value }))}
                  disabled={busy}
                >
                  {available.map((name) => (
                    <NativeSelectOption key={name} value={name}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="setup-balance">Opening balance (₹)</FieldLabel>
                  <Input
                    id="setup-balance"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form.opening_balance}
                    onChange={(e) => setForm((prev) => ({ ...prev, opening_balance: e.target.value }))}
                    disabled={busy}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="setup-month">Opening month</FieldLabel>
                  <Input
                    id="setup-month"
                    type="month"
                    value={form.opening_month}
                    onChange={(e) => setForm((prev) => ({ ...prev, opening_month: e.target.value }))}
                    disabled={busy}
                  />
                  <FieldDescription>Balance as of the 1st.</FieldDescription>
                </Field>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-none shadow-none"
                disabled={busy}
                onClick={() => void handleAdd()}
              >
                <Plus className="size-4" />
                {busy ? "Adding…" : "Add bank"}
              </Button>
            </div>
          ) : (
            <StatusAlert variant="success" title="All available banks are added." />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-parsel-border bg-parsel-soft/40 px-6 py-4">
          <p className="text-xs text-parsel-muted">
            {canContinue ? "You're all set." : "Add at least one bank to continue."}
          </p>
          <Button type="button" disabled={!canContinue} onClick={() => navigate("/overview", { replace: true })}>
            Continue to dashboard
          </Button>
        </footer>
      </div>
    </div>
  );
}
