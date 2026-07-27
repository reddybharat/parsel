import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDeleteDialog({
  open,
  loading,
  itemLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  loading: boolean;
  itemLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-md sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight text-parsel-neutral">Delete Transaction?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this entry for {itemLabel}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button className="flex-1" variant="destructive" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete Entry"}
          </Button>
          <Button className="flex-1" variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
