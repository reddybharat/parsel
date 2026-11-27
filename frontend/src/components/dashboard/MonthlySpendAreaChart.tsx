import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/feedback/EmptyState";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatInrAmount, formatInrCompact } from "@/lib/format";
import { Y_AXIS_WIDTH } from "@/components/dashboard/BankBalanceLegend";

type TrendPoint = { month_label: string; spend: number };

const chartConfig = {
  spend: {
    label: "Spending",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const FILL_ID = "monthly-spend-fill";

export function MonthlySpendAreaChart({
  points,
  spendDeltaPct,
  compact = false,
  partialLast = false,
  onMonthClick,
}: {
  points: TrendPoint[];
  spendDeltaPct: number | null;
  /** Chart only: no title or footer, for the Overview balance strip. */
  compact?: boolean;
  /** The last month is still running: dash its segment and mark its total as "so far". */
  partialLast?: boolean;
  onMonthClick?: (index: number) => void;
}) {
  if (points.length === 0) {
    return (
      <Card className="flex h-full min-h-0 flex-col border-0 shadow-none">
        <CardContent className="flex min-h-0 flex-1 flex-col px-0 pt-4">
          <EmptyState title="No trend data" detail="Add transactions to visualize monthly spend." />
        </CardContent>
      </Card>
    );
  }

  const lastIndex = points.length - 1;
  // `solid` and `partial` split the drawn line so the running month's segment can be dashed;
  // `spend` carries every month for the dots and tooltip.
  const chartData = points.map((point, index) => ({
    month: point.month_label,
    spend: point.spend,
    solid: partialLast && index === lastIndex ? null : point.spend,
    partial: partialLast && index >= lastIndex - 1 ? point.spend : null,
    soFar: partialLast && index === lastIndex,
  }));
  const firstMonth = points[0]?.month_label ?? "";
  const lastMonth = points[lastIndex]?.month_label ?? "";
  const deltaUp = spendDeltaPct !== null && spendDeltaPct >= 0;

  return (
    <Card className="flex h-full min-h-0 flex-col border-0 shadow-none">
      {compact ? null : (
        <CardHeader className="shrink-0 p-0 pb-2">
          <CardTitle className="text-sm font-semibold">Monthly Spending Trend</CardTitle>
          <CardDescription>
            {firstMonth} – {lastMonth}
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex min-h-0 flex-1 flex-col px-0 pb-0">
        <ChartContainer config={chartConfig} className={compact ? "aspect-auto h-full min-h-0 w-full" : "aspect-auto h-full min-h-[7rem] w-full"}>
          <ComposedChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 12, top: 6 }}
            className={onMonthClick ? "cursor-pointer" : undefined}
            onClick={(state) => {
              const index = state?.activeTooltipIndex;
              if (index != null) onMonthClick?.(Number(index));
            }}
          >
            <defs>
              <linearGradient id={FILL_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-spend)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-spend)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={4}
              axisLine={false}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <YAxis
              width={Y_AXIS_WIDTH}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickCount={4}
              tickFormatter={(value) => formatInrCompact(Number(value))}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => {
                    const amount = formatInrAmount(Number(value));
                    return (item.payload as { soFar?: boolean }).soFar ? `${amount} so far` : amount;
                  }}
                />
              }
            />
            <Area
              dataKey="solid"
              type="monotone"
              stroke="var(--color-spend)"
              strokeWidth={2}
              fill={`url(#${FILL_ID})`}
              dot={false}
              activeDot={false}
              tooltipType="none"
            />
            <Area
              dataKey="partial"
              type="monotone"
              stroke="var(--color-spend)"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill={`url(#${FILL_ID})`}
              fillOpacity={0.5}
              dot={false}
              activeDot={false}
              tooltipType="none"
            />
            <Line
              dataKey="spend"
              stroke="none"
              dot={({ cx, cy, index }) => (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={3}
                  strokeWidth={2}
                  stroke="var(--color-spend)"
                  fill={partialLast && index === lastIndex ? "var(--parsel-surface)" : "var(--color-spend)"}
                />
              )}
              activeDot={{ r: 5, fill: "var(--color-spend)" }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
      {spendDeltaPct !== null && !compact ? (
        <CardFooter className="mt-auto shrink-0 flex-col items-start gap-1 p-0 pt-3 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            {deltaUp ? "Trending up" : "Trending down"} by {Math.abs(spendDeltaPct).toFixed(1)}% vs last month
            {deltaUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </div>
          <div className="text-xs leading-none text-muted-foreground">
            Monthly spend over the last {points.length} months
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
