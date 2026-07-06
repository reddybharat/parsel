export function ChartSkeleton() {
  return (
    <div className="flex min-h-[120px] flex-1 flex-col justify-end gap-2 pt-4" aria-hidden>
      <div className="flex h-24 items-end gap-1.5">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-sm bg-[#e8eef4]"
            style={{ height: `${28 + (i % 4) * 14}%` }}
          />
        ))}
      </div>
      <div className="h-3 w-24 animate-pulse rounded bg-[#e8eef4]" />
    </div>
  );
}
