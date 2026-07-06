import { Spinner } from "@/components/ui/spinner";

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-parsel-border bg-parsel-soft p-6 text-sm text-parsel-muted"
      role="status"
    >
      <Spinner className="size-5 text-parsel-primary" />
      <span>{label}</span>
    </div>
  );
}
