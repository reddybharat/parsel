import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatInrAmount } from "@/lib/format";

type DailyPoint = { day: number; spend: number };

const chartConfig = {
  spend: {
    label: "Spending",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function DailySpendLineChart({
  points,
  monthLabel,
  monthTotal,
}: {
  points: DailyPoint[];
  monthLabel: string;
  monthTotal: number;
}) {
  const maxDay = points[points.length - 1]?.day ?? 31;
  const axisTicks = [1, 15, maxDay].filter((tick, index, arr) => arr.indexOf(tick) === index);

  if (points.length === 0) {
    return (
      <Card className="flex h-full min-h-0 flex-col border-0 shadow-none">
        <CardContent className="flex min-h-0 flex-1 flex-col px-0 pt-4">
          <div className="h-full min-h-[7rem] rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const chartData = points.map((point) => ({
    day: point.day,
    spend: point.spend,
  }));

  return (
    <Card className="flex h-full min-h-0 flex-col border-0 shadow-none">
      <CardHeader className="shrink-0 p-0 pb-2">
        <CardTitle className="text-sm font-semibold">Daily Spending Trends</CardTitle>
        <CardDescription>{monthLabel} — day-by-day spending</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-0 pb-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-full min-h-[7rem] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              ticks={axisTicks}
              tickFormatter={(value) => `Day ${value}`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => {
                    const day = (item.payload as DailyPoint | undefined)?.day;
                    return day ? `Day ${day}: ${formatInrAmount(Number(value))}` : formatInrAmount(Number(value));
                  }}
                />
              }
            />
            <Line dataKey="spend" type="linear" stroke="var(--color-spend)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="mt-auto shrink-0 flex-col items-start gap-1 p-0 pt-3 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          {formatInrAmount(monthTotal)} spent this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-xs leading-none text-muted-foreground">Spending by day this month</div>
      </CardFooter>
    </Card>
  );
}
