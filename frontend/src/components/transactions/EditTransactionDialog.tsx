import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export function EditTransactionDialog({
  open,
  transaction,
  categories,
  paymentMethods,
  loading,
  onChange,
  onSave,
  onCancel,
}: {
  open: boolean;
  transaction: Transaction | null;
  categories: string[];
  paymentMethods: string[];
  loading: boolean;
  onChange: (next: Transaction) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-xl sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight text-parsel-neutral">Edit Transaction</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="edit-type">Transaction Type</Label>
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
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="edit-amount">Amount</Label>
            <Input
              id="edit-amount"
              className="text-destructive tabular-nums"
              type="number"
              min={0.01}
              step={0.01}
              value={transaction.amount}
              onChange={(e) => onChange({ ...transaction, amount: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <NativeSelect
              id="edit-category"
              value={transaction.category}
              onChange={(e) => onChange({ ...transaction, category: e.target.value })}
            >
              {categories.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-date">Date</Label>
            <Input
              id="edit-date"
              type="date"
              value={transaction.transaction_date}
              onChange={(e) => onChange({ ...transaction, transaction_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-payment">Payment Method</Label>
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
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              rows={3}
              value={transaction.description || ""}
              onChange={(e) => onChange({ ...transaction, description: e.target.value || null })}
              placeholder="Description"
            />
          </div>
        </div>
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
