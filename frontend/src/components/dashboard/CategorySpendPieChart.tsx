import * as React from "react";
import { Pie, PieChart } from "recharts";

import { EmptyState } from "@/components/feedback/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
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
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
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
      <CardHeader className="items-center p-0 pb-0">
        <CardTitle className="text-sm font-semibold">Category Spend</CardTitle>
        <CardDescription>{monthLabel || "This month"}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-0 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => (
                    <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {formatInrAmount(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie data={chartData} dataKey="spend" nameKey="category" stroke="0" />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
