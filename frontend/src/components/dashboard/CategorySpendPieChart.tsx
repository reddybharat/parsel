import * as React from "react";
import { Pie, PieChart } from "recharts";

import { EmptyState } from "@/components/feedback/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatInrAmount } from "@/lib/format";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type CategorySpendItem = { category: string; spend: number };

function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildChartConfig(items: CategorySpendItem[]): ChartConfig {
  const config: ChartConfig = {
    spend: { label: "Spend" },
  };
  items.forEach((item, index) => {
    const slug = categorySlug(item.category);
    config[slug] = {
      label: item.category,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  });
  return config;
}

export function CategorySpendPieChart({
  items,
  monthLabel,
}: {
  items: CategorySpendItem[];
  monthLabel: string;
}) {
  const chartConfig = React.useMemo(() => buildChartConfig(items), [items]);

  const chartData = React.useMemo(
    () =>
      items.map((item) => {
        const slug = categorySlug(item.category);
        return {
          category: item.category,
          slug,
          spend: item.spend,
          fill: `var(--color-${slug})`,
        };
      }),
    [items],
  );

  if (items.length === 0) {
    return (
      <Card className="border-0 shadow-none">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-sm font-semibold">Category Spend</CardTitle>
          <CardDescription>{monthLabel || "This month"}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-4">
          <EmptyState title="No spending data" detail="Category breakdown appears when you have spend this month." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col border-0 shadow-none">
      <CardHeader className="shrink-0 p-0 pb-2">
        <CardTitle className="text-sm font-semibold">Category Spend</CardTitle>
        <CardDescription>{monthLabel || "This month"}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col justify-center px-0 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-h-full">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel formatter={(value) => formatInrAmount(Number(value))} />}
            />
            <Pie data={chartData} dataKey="spend" nameKey="category" />
            <ChartLegend
              content={<ChartLegendContent nameKey="slug" />}
              className="-translate-y-2 flex-wrap gap-2 *:basis-1/2 *:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
