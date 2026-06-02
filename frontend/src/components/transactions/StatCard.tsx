export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-xl border border-parsel-border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-parsel-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-sm text-parsel-muted">{hint}</p> : null}
    </article>
  );
}
