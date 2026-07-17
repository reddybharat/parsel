import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/feedback/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatInrAmount } from "@/lib/format";

const TOP_N = 5;

const chartConfig = {
  spend: {
    label: "Spend",
    color: "hsl(var(--chart-1))",
  },
  label: {
    color: "hsl(var(--background))",
  },
} satisfies ChartConfig;

type CategorySpendItem = { category: string; spend: number };

export function CategorySpendBarChart({
  items,
  monthLabel,
}: {
  items: CategorySpendItem[];
  monthLabel: string;
}) {
  const topItems = items.slice(0, TOP_N);
  const chartData = topItems.map((item) => ({
    category: item.category,
    spend: item.spend,
  }));

  if (chartData.length === 0) {
    return (
      <Card className="flex flex-col border-0 shadow-none">
        <CardHeader className="items-center p-0 pb-0">
          <CardTitle className="text-sm font-semibold">Category Spend</CardTitle>
          <CardDescription>{monthLabel || "This month"}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 px-0 pb-0 pt-4">
          <EmptyState title="No spending data" detail="Category breakdown appears when you have spend this month." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col border-0 shadow-none">
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-sm font-semibold">Category Spend</CardTitle>
        <CardDescription>
          Top {TOP_N} · {monthLabel || "This month"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 px-0 pb-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-full min-h-[160px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 0, right: 56 }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              hide
            />
            <XAxis dataKey="spend" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value) => formatInrAmount(Number(value))}
                />
              }
            />
            <Bar dataKey="spend" fill="var(--color-spend)" radius={4}>
              <LabelList
                dataKey="category"
                position="insideLeft"
                offset={8}
                className="fill-background"
                fontSize={12}
              />
              <LabelList
                dataKey="spend"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
                formatter={(value) => formatInrAmount(Number(value))}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
