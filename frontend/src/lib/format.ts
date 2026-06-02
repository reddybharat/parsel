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
