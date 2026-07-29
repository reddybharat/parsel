import { CategorySelect } from "@/components/transactions/CategorySelect";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export function EditTransactionDialog({
  open,
  transaction,
  categories,
  paymentMethods,
  loading,
  onChange,
  onCategoriesChange,
  onSave,
  onCancel,
}: {
  open: boolean;
  transaction: Transaction | null;
  categories: Category[];
  paymentMethods: string[];
  loading: boolean;
  onChange: (next: Transaction) => void;
  onCategoriesChange?: (next: Category[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-xl sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight text-parsel-neutral">Edit Transaction</DialogTitle>
        </DialogHeader>
        <FieldGroup className="grid gap-3 md:grid-cols-2">
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="edit-type">Transaction Type</FieldLabel>
            <div className="flex w-fit items-center gap-3">
              <span
                className={cn(
                  "text-sm",
                  transaction.is_debit ? "font-medium text-parsel-primary" : "text-parsel-muted",
                )}
              >
                Debit
              </span>
              <Switch
                id="edit-type"
                checked={!transaction.is_debit}
                onCheckedChange={(checked) => onChange({ ...transaction, is_debit: !checked })}
                aria-label="Transaction type"
              />
              <span
                className={cn(
                  "text-sm",
                  !transaction.is_debit ? "font-medium text-parsel-primary" : "text-parsel-muted",
                )}
              >
                Credit
              </span>
            </div>
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="edit-amount">Amount</FieldLabel>
            <Input
              id="edit-amount"
              className="text-destructive tabular-nums"
              type="number"
              min={0.01}
              step={0.01}
              value={transaction.amount}
              onChange={(e) => onChange({ ...transaction, amount: Number(e.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-category">Category</FieldLabel>
            <CategorySelect
              id="edit-category"
              value={transaction.category}
              categories={categories}
              onChange={(name) => onChange({ ...transaction, category: name })}
              onCategoriesChange={onCategoriesChange}
              allowEmpty={false}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-date">Date</FieldLabel>
            <DatePicker
              id="edit-date"
              value={transaction.transaction_date}
              onChange={(value) => onChange({ ...transaction, transaction_date: value })}
              placeholder="Select date"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="edit-payment">Payment Method</FieldLabel>
            <NativeSelect
              id="edit-payment"
              value={transaction.payment_method || ""}
              onChange={(e) => onChange({ ...transaction, payment_method: e.target.value || null })}
            >
              <NativeSelectOption value="">Select payment method</NativeSelectOption>
              {paymentMethods.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="edit-description">Description</FieldLabel>
            <Textarea
              id="edit-description"
              rows={3}
              value={transaction.description || ""}
              onChange={(e) => onChange({ ...transaction, description: e.target.value || null })}
              placeholder="Description"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
