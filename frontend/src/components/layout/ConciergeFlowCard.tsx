const STEPS = [
  "Check overview signals",
  "Review spending anomalies",
  "Fix or classify transactions",
  "Ask AI assistant for insights",
];

export function ConciergeFlowCard() {
  return (
    <section className="rounded-xl border border-parsel-border bg-parsel-soft p-4">
      <h3 className="text-base font-semibold">Parsel Financial Concierge Flow</h3>
      <p className="mt-1 text-sm text-parsel-muted">A guided loop to keep your ledger clean and decisions clear.</p>
      <ol className="mt-3 grid gap-2 text-sm">
        {STEPS.map((step, index) => (
          <li key={step} className="rounded-lg bg-white px-3 py-2">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
