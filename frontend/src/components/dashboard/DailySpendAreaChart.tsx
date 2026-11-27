import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { SERIES_COLORS, Y_AXIS_WIDTH } from "@/components/dashboard/BankBalanceLegend";
import { formatInrAmount, formatInrCompact } from "@/lib/format";
import type { DailySpendSeries } from "@/lib/types";

export function DailySpendAreaChart({
  series,
  monthLabel,
  monthTotal,
  compact = false,
  onDayClick,
}: {
  series: DailySpendSeries[];
  monthLabel: string;
  monthTotal: number;
  /** Chart only: no title, legend or footer, for the Overview balance strip. */
  compact?: boolean;
  onDayClick?: (day: number) => void;
}) {
  const hasData = series.length > 0 && series.some((s) => s.points.length > 0);

  if (!hasData) {
    return (
      <Card className="flex h-full min-h-0 flex-col border-0 shadow-none">
        <CardHeader className="shrink-0 p-0 pb-2">
          <CardTitle className="text-sm font-semibold">Daily Spending Trends</CardTitle>
          <CardDescription>{monthLabel} — day-by-day spending</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-0 pt-4">
          <div className="flex h-full min-h-[7rem] items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
            No spending recorded this month
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = series.reduce<ChartConfig>((config, item, index) => {
    config[item.bank] = {
      label: item.bank,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    };
    return config;
  }, {});

  // All series share the same dense day grid; use the longest to be safe.
  const days = series.reduce<number[]>((longest, item) => {
    const current = item.points.map((point) => point.day);
    return current.length > longest.length ? current : longest;
  }, []);

  const chartData = days.map((day, dayIndex) => {
    const row: Record<string, number> = { day };
    for (const item of series) {
      row[item.bank] = item.points[dayIndex]?.spend ?? 0;
    }
    return row;
  });

  const maxDay = days[days.length - 1] ?? 31;
  const axisTicks = [1, 15, maxDay].filter((tick, index, arr) => arr.indexOf(tick) === index);

  return (
    <Card className="flex h-full min-h-0 flex-col border-0 shadow-none">
      {compact ? null : (
        <CardHeader className="shrink-0 p-0 pb-2">
          <CardTitle className="text-sm font-semibold">Daily Spending Trends</CardTitle>
          <CardDescription>{monthLabel} — day-by-day spending per bank</CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex min-h-0 flex-1 flex-col px-0 pb-0">
        <ChartContainer
          config={chartConfig}
          className={compact ? "aspect-auto h-full min-h-0 w-full" : "aspect-auto h-full min-h-[7rem] w-full"}
        >
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 12, top: 6 }}
            className={onDayClick ? "cursor-pointer" : undefined}
            onClick={(state) => {
              const day = Number(state?.activeLabel);
              if (day) onDayClick?.(day);
            }}
          >
            <defs>
              {series.map((item) => (
                <linearGradient key={item.bank} id={`daily-fill-${item.bank}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(--color-${item.bank})`} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={`var(--color-${item.bank})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              ticks={axisTicks}
              tickFormatter={(value) => `Day ${value}`}
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
                  labelFormatter={(_value, payload) => {
                    const day = (payload?.[0]?.payload as { day?: number } | undefined)?.day;
                    return day ? `Day ${day}` : "";
                  }}
                  formatter={(value, name) => `${name}: ${formatInrAmount(Number(value))}`}
                />
              }
            />
            {compact ? null : <ChartLegend content={<ChartLegendContent />} />}
            {series.map((item) => (
              <Area
                key={item.bank}
                dataKey={item.bank}
                type="monotone"
                stroke={`var(--color-${item.bank})`}
                strokeWidth={2}
                fill={`url(#daily-fill-${item.bank})`}
                dot={false}
                activeDot={{ r: 4, fill: `var(--color-${item.bank})` }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
      {compact ? null : (
        <CardFooter className="mt-auto shrink-0 flex-col items-start gap-1 p-0 pt-3 text-sm">
          <div className="flex gap-2 font-medium leading-none">
            {formatInrAmount(monthTotal)} spent this month <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-xs leading-none text-muted-foreground">Spending by day this month</div>
        </CardFooter>
      )}
    </Card>
  );
}
