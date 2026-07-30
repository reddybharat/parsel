import { FormEvent, useState } from "react";

import { InlineProgress } from "@/components/feedback/InlineProgress";
import { StatusAlert, type FeedbackMessage } from "@/components/feedback/StatusAlert";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { localDateIso } from "@/components/transactions/LedgerDateRange";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { invalidateDashboardOverview } from "@/lib/dashboardQuery";
import { createTransaction } from "@/api/tracker";
import type { Category } from "@/lib/types";

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-parsel-secondary";

export function AddTransactionDrawer({
  open,
  onOpenChange,
  categories,
  paymentMethods,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  paymentMethods: string[];
  onSaved?: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [isDebit, setIsDebit] = useState(true);
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionDate, setTransactionDate] = useState(localDateIso());
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setAmount(0);
    setIsDebit(true);
    setCategory("");
    setPaymentMethod("");
    setTransactionDate(localDateIso());
    setDescription("");
    setFeedback(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      await createTransaction({
        amount,
        is_debit: isDebit,
        category,
        payment_method: paymentMethod || null,
        transaction_date: transactionDate,
        description: description.trim() || null,
      });
      void invalidateDashboardOverview();
      onSaved?.();
      setFeedback({ variant: "success", title: "Transaction saved" });
      setAmount(0);
      setDescription("");
    } catch (err) {
      setFeedback({
        variant: "error",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Failed to save transaction.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-semibold tracking-tight text-parsel-neutral">
            Add Transaction
          </DrawerTitle>
        </DrawerHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <FieldGroup className="grid gap-5">
              <Field>
                <FieldLabel className={fieldLabelClass}>Transaction Type</FieldLabel>
                <div className="flex w-fit items-center gap-3">
                  <span className={cn("text-sm", isDebit ? "font-medium text-parsel-primary" : "text-parsel-muted")}>
                    Debit
                  </span>
                  <Switch
                    checked={!isDebit}
                    onCheckedChange={(checked) => setIsDebit(!checked)}
                    aria-label="Transaction type"
                  />
                  <span className={cn("text-sm", !isDebit ? "font-medium text-parsel-primary" : "text-parsel-muted")}>
                    Credit
                  </span>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="drawer-amount" className={fieldLabelClass}>
                  Amount
                </FieldLabel>
                <div className="flex overflow-hidden rounded-none border border-input">
                  <span className="flex items-center bg-parsel-soft px-3 text-sm text-parsel-muted">₹</span>
                  <Input
                    id="drawer-amount"
                    className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 tabular-nums"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="drawer-category" className={fieldLabelClass}>
                  Category
                </FieldLabel>
                <CategorySelect
                  id="drawer-category"
                  value={category}
                  categories={categories}
                  onChange={setCategory}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="drawer-date" className={fieldLabelClass}>
                  Transaction Date
                </FieldLabel>
                <DatePicker
                  id="drawer-date"
                  value={transactionDate}
                  onChange={setTransactionDate}
                  placeholder="Select date"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="drawer-payment" className={fieldLabelClass}>
                  Payment Method
                </FieldLabel>
                <NativeSelect
                  id="drawer-payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <NativeSelectOption value="">Select Account</NativeSelectOption>
                  {paymentMethods.map((item) => (
                    <NativeSelectOption key={item} value={item}>
                      {item}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="drawer-description" className={fieldLabelClass}>
                  Description / Notes
                </FieldLabel>
                <Textarea
                  id="drawer-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What was this for?"
                />
              </Field>
              {feedback ? <StatusAlert {...feedback} onDismiss={() => setFeedback(null)} /> : null}
              {saving ? <InlineProgress label="Saving transaction…" /> : null}
            </FieldGroup>
          </div>

          <DrawerFooter className="shrink-0 pt-4">
            <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Transaction"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
