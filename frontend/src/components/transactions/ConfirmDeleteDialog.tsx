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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#667085]/60 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-xl border border-parsel-border bg-white p-5 shadow-lg">
        <h3 className="text-[32px] font-semibold tracking-tight text-parsel-neutral">Delete Transaction?</h3>
        <p className="mt-2 text-sm text-parsel-muted">Are you sure you want to delete this entry for {itemLabel}? This action cannot be undone.</p>
        <div className="mt-5 flex gap-2">
          <button
            className="flex-1 rounded-lg bg-[#d31859] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete Entry"}
          </button>
          <button className="flex-1 rounded-lg bg-[#eceff4] px-3 py-2 text-sm font-semibold text-parsel-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
