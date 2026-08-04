import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";

import { createBank, updateBank } from "@/api/tracker";
import { StatusAlert } from "@/components/feedback/StatusAlert";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { banksQueryOptions, setProfileBanks } from "@/lib/banksQuery";
import { currentMonthValue, formatMonthValueLabel, invalidateDashboardOverview } from "@/lib/dashboardQuery";
import { formatInrAmount } from "@/lib/format";
import { trackerConfigQueryOptions } from "@/lib/trackerConfigQuery";
import type { ProfileBank } from "@/lib/types";

type AddForm = { bank: string; opening_balance: string; opening_month: string };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function BanksManager() {
  const { data: banks = [], isPending } = useQuery(banksQueryOptions());
  const { data: trackerConfig } = useQuery(trackerConfigQueryOptions());
  const catalog = trackerConfig?.bank_catalog ?? [];

  const addedNames = new Set(banks.map((b) => b.bank));
  const available = catalog.filter((name) => !addedNames.has(name));

  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyBank, setBusyBank] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    bank: "",
    opening_balance: "",
    opening_month: currentMonthValue(),
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const [editing, setEditing] = useState<ProfileBank | null>(null);
  const [editForm, setEditForm] = useState({ opening_balance: "", opening_month: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  function openAdd() {
    setAddForm({
      bank: available[0] ?? "",
      opening_balance: "",
      opening_month: currentMonthValue(),
    });
    setAddError(null);
    setAddOpen(true);
  }

  function handleAddOpenChange(next: boolean) {
    if (addBusy) return;
    setAddOpen(next);
    if (!next) setAddError(null);
  }

  async function handleAdd() {
    const balance = Number(addForm.opening_balance);
    if (!addForm.bank) {
      setAddError("Please select a bank.");
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      setAddError("Opening balance must be zero or more.");
      return;
    }
    if (!addForm.opening_month) {
      setAddError("Please choose an opening month.");
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const created = await createBank({
        bank: addForm.bank,
        opening_balance: balance,
        opening_month: addForm.opening_month,
      });
      setProfileBanks([...banks, created]);
      void invalidateDashboardOverview();
      setAddOpen(false);
    } catch (err) {
      setAddError(errorMessage(err, "Could not add bank."));
    } finally {
      setAddBusy(false);
    }
  }

  function openEdit(bank: ProfileBank) {
    setEditing(bank);
    setEditForm({
      opening_balance: String(bank.opening_balance),
      opening_month: bank.opening_month,
    });
    setEditError(null);
  }

  function handleEditOpenChange(next: boolean) {
    if (editBusy) return;
    if (!next) {
      setEditing(null);
      setEditError(null);
    }
  }

  async function handleEdit() {
    if (!editing) return;
    const balance = Number(editForm.opening_balance);
    if (!Number.isFinite(balance) || balance < 0) {
      setEditError("Opening balance must be zero or more.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const updated = await updateBank(editing.bank, {
        opening_balance: balance,
        opening_month: editForm.opening_month,
      });
      setProfileBanks(banks.map((b) => (b.bank === updated.bank ? updated : b)));
      void invalidateDashboardOverview();
      setEditing(null);
    } catch (err) {
      setEditError(errorMessage(err, "Could not update bank."));
    } finally {
      setEditBusy(false);
    }
  }

  async function toggleActive(bank: ProfileBank, nextActive: boolean) {
    setBusyBank(bank.bank);
    setFeedback(null);
    try {
      const updated = await updateBank(bank.bank, { is_active: nextActive });
      setProfileBanks(banks.map((b) => (b.bank === updated.bank ? updated : b)));
      void invalidateDashboardOverview();
    } catch (err) {
      setFeedback(errorMessage(err, "Could not update bank."));
    } finally {
      setBusyBank(null);
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-parsel-muted">
          {banks.length} bank{banks.length === 1 ? "" : "s"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-none shadow-none"
          disabled={available.length === 0}
          onClick={openAdd}
        >
          <Plus className="size-3.5" />
          Add bank
        </Button>
      </div>

      {feedback ? (
        <div className="mb-3">
          <StatusAlert variant="error" title={feedback} onDismiss={() => setFeedback(null)} />
        </div>
      ) : null}

      {isPending ? (
        <p className="text-sm text-parsel-muted">Loading banks…</p>
      ) : banks.length === 0 ? (
        <p className="text-sm text-parsel-muted">
          No banks yet. Add one to start tracking balances.
        </p>
      ) : (
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
              <div className="flex shrink-0 items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-parsel-muted">
                  <Switch
                    checked={bank.is_active}
                    disabled={busyBank === bank.bank}
                    onCheckedChange={(checked) => void toggleActive(bank, checked)}
                    aria-label={`${bank.bank} active`}
                  />
                  {bank.is_active ? "Active" : "Inactive"}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busyBank === bank.bank}
                  onClick={() => openEdit(bank)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer open={addOpen} onOpenChange={handleAddOpenChange}>
        <DrawerContent className="sm:max-w-md" showCloseButton={!addBusy}>
          <DrawerHeader>
            <DrawerTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Add bank
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <Field>
              <FieldLabel htmlFor="add-bank-name">Bank</FieldLabel>
              <NativeSelect
                id="add-bank-name"
                value={addForm.bank}
                onChange={(e) => setAddForm((prev) => ({ ...prev, bank: e.target.value }))}
                disabled={addBusy}
              >
                {available.map((name) => (
                  <NativeSelectOption key={name} value={name}>
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="add-bank-balance">Opening balance (₹)</FieldLabel>
              <Input
                id="add-bank-balance"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={addForm.opening_balance}
                onChange={(e) => setAddForm((prev) => ({ ...prev, opening_balance: e.target.value }))}
                disabled={addBusy}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="add-bank-month">Opening month</FieldLabel>
              <Input
                id="add-bank-month"
                type="month"
                value={addForm.opening_month}
                onChange={(e) => setAddForm((prev) => ({ ...prev, opening_month: e.target.value }))}
                disabled={addBusy}
              />
              <FieldDescription>The balance as of the 1st of this month.</FieldDescription>
            </Field>
            {addError ? <p className="text-sm text-destructive">{addError}</p> : null}
          </div>
          <DrawerFooter className="shrink-0">
            <Button
              type="button"
              variant="ghost"
              disabled={addBusy}
              onClick={() => handleAddOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={addBusy} onClick={() => void handleAdd()}>
              {addBusy ? "Adding…" : "Add bank"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={Boolean(editing)} onOpenChange={handleEditOpenChange}>
        <DrawerContent className="sm:max-w-md" showCloseButton={!editBusy}>
          <DrawerHeader>
            <DrawerTitle className="text-xl font-semibold tracking-tight text-parsel-neutral">
              Edit {editing?.bank}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <Field>
              <FieldLabel htmlFor="edit-bank-balance">Opening balance (₹)</FieldLabel>
              <Input
                id="edit-bank-balance"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={editForm.opening_balance}
                onChange={(e) => setEditForm((prev) => ({ ...prev, opening_balance: e.target.value }))}
                disabled={editBusy}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-bank-month">Opening month</FieldLabel>
              <Input
                id="edit-bank-month"
                type="month"
                value={editForm.opening_month}
                onChange={(e) => setEditForm((prev) => ({ ...prev, opening_month: e.target.value }))}
                disabled={editBusy}
              />
            </Field>
            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
          </div>
          <DrawerFooter className="shrink-0">
            <Button
              type="button"
              variant="ghost"
              disabled={editBusy}
              onClick={() => handleEditOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={editBusy} onClick={() => void handleEdit()}>
              {editBusy ? "Saving…" : "Save"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
