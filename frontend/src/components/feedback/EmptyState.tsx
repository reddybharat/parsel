import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Empty className="border border-dashed border-parsel-border bg-parsel-soft p-6 md:p-8">
      <EmptyHeader>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{detail}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
