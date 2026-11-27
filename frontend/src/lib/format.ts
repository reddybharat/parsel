export function formatInrSigned(amount: number): string {
  const core = `₹${Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return amount < 0 ? `(${core})` : core;
}

export function signedAmount(amount: number, isDebit: boolean): number {
  return isDebit ? -amount : amount;
}

export function formatInrAmount(amount: number): string {
  return `₹${Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const INR_COMPACT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Short axis label: ₹950, ₹15K, ₹1.2L, ₹3Cr. */
export function formatInrCompact(amount: number): string {
  return INR_COMPACT.format(amount);
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
