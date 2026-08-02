const BANK_LOGOS: Record<string, string> = {
  SBI: "/banks/sbi.svg",
  Kotak: "/banks/kotak.svg",
  Slice: "/banks/slice.svg",
};

export function bankLogoSrc(bank: string): string | undefined {
  return BANK_LOGOS[bank];
}

export function bankInitials(bank: string): string {
  const cleaned = bank.trim();
  if (cleaned.length <= 3) return cleaned.toUpperCase();
  return cleaned
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
