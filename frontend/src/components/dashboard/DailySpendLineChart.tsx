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
      <Card className="border-0 shadow-none">
        <CardContent className="px-0 pt-4">
          <div className="h-28 rounded-lg bg-muted sm:h-32" />
        </CardContent>
      </Card>
    );
  }

  const chartData = points.map((point) => ({
    day: point.day,
    spend: point.spend,
  }));

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-sm font-semibold">Daily Spending Trends</CardTitle>
        <CardDescription>{monthLabel} — day-by-day spending</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-28 w-full sm:h-32">
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
      <CardFooter className="flex-col items-start gap-1 p-0 pt-2 text-sm">
        <div className="flex gap-2 font-medium leading-none">
          {formatInrAmount(monthTotal)} spent this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-xs leading-none text-muted-foreground">Spending by day this month</div>
      </CardFooter>
    </Card>
  );
}
