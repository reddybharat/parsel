export function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-parsel-border bg-parsel-soft p-6 text-sm text-parsel-muted" role="status">
      {label}
    </div>
  );
}
