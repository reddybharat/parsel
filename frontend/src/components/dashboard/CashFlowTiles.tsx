import { formatInrAmount } from "@/lib/format";

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-parsel-secondary";

type CashFlowTilesProps = {
  inflow: number;
  outflow: number;
  investments: number;
  tileClassName: string;
};

function CashFlowTile({
  label,
  amount,
  amountClassName,
  tileClassName,
}: {
  label: string;
  amount: number;
  amountClassName: string;
  tileClassName: string;
}) {
  return (
    <article className={tileClassName}>
      <p className={SECTION_LABEL}>{label}</p>
      <p className={`mt-0.5 truncate tabular-nums text-sm font-semibold ${amountClassName}`}>
        {formatInrAmount(amount)}
      </p>
      <p className="text-[10px] text-parsel-muted">This month</p>
    </article>
  );
}

export function CashFlowTiles({ inflow, outflow, investments, tileClassName }: CashFlowTilesProps) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <CashFlowTile label="Inflow" amount={inflow} amountClassName="text-[#2563eb]" tileClassName={tileClassName} />
        <CashFlowTile label="Outflow" amount={outflow} amountClassName="text-[#dc2626]" tileClassName={tileClassName} />
      </div>
      <CashFlowTile
        label="Investments"
        amount={investments}
        amountClassName="text-parsel-neutral"
        tileClassName={tileClassName}
      />
    </div>
  );
}
