export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-parsel-border bg-parsel-soft p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-parsel-muted">{detail}</p>
    </div>
  );
}
