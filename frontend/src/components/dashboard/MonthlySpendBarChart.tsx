import { TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { EmptyState } from "@/components/feedback/EmptyState";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatInrAmount } from "@/lib/format";

type TrendPoint = { month_label: string; spend: number };

const chartConfig = {
  spend: {
    label: "Spending",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function MonthlySpendBarChart({
  points,
  spendDeltaPct,
}: {
  points: TrendPoint[];
  spendDeltaPct: number | null;
}) {
  if (points.length === 0) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent className="px-0 pt-4">
          <EmptyState title="No trend data" detail="Add transactions to visualize monthly spend." />
        </CardContent>
      </Card>
    );
  }

  const chartData = points.map((point) => ({
    month: point.month_label,
    spend: point.spend,
  }));
  const firstMonth = points[0]?.month_label ?? "";
  const lastMonth = points[points.length - 1]?.month_label ?? "";
  const deltaUp = spendDeltaPct !== null && spendDeltaPct >= 0;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-sm font-semibold">Monthly Spending Trend</CardTitle>
        <CardDescription>
          {firstMonth} – {lastMonth}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-28 w-full sm:h-32">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value) => formatInrAmount(Number(value))}
                />
              }
            />
            <Bar dataKey="spend" fill="var(--color-spend)" radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      {spendDeltaPct !== null ? (
        <CardFooter className="flex-col items-start gap-1 p-0 pt-2 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            {deltaUp ? "Trending up" : "Trending down"} by {Math.abs(spendDeltaPct).toFixed(1)}% vs last month
            {deltaUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </div>
          <div className="text-xs leading-none text-muted-foreground">Monthly spend over the last {points.length} months</div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
