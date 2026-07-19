import { useState, type KeyboardEvent } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/feedback/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatInrAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

const TOP_N = 5;
const BAR_ROW_PX = 32;

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

function toChartData(items: CategorySpendItem[]) {
  return items.map((item) => ({
    category: item.category,
    spend: item.spend,
  }));
}

function FirstCategoryLabel({
  x,
  y,
  height,
  value,
  index,
}: {
  x?: number | string;
  y?: number | string;
  height?: number | string;
  value?: string | number;
  index?: number;
}) {
  if (index !== 0 || value == null || x == null || y == null || height == null) {
    return null;
  }

  return (
    <text
      x={Number(x) + 8}
      y={Number(y) + Number(height) / 2}
      textAnchor="start"
      dominantBaseline="middle"
      className="fill-background"
      fontSize={12}
    >
      {value}
    </text>
  );
}

function CategoryBarChart({
  data,
  className,
}: {
  data: ReturnType<typeof toChartData>;
  className?: string;
}) {
  return (
    <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", className)}>
      <BarChart
        accessibilityLayer
        data={data}
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
              hideIndicator
              formatter={(value, _name, item) => {
                const category = item.payload?.category;
                const label = typeof category === "string" ? category : "";
                return (
                  <span className="font-medium text-foreground">
                    {label ? `${label}: ${formatInrAmount(Number(value))}` : formatInrAmount(Number(value))}
                  </span>
                );
              }}
            />
          }
        />
        <Bar dataKey="spend" fill="var(--color-spend)" radius={4}>
          <LabelList dataKey="category" content={<FirstCategoryLabel />} />
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
  );
}

export function CategorySpendBarChart({
  items,
  monthLabel,
}: {
  items: CategorySpendItem[];
  monthLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const period = monthLabel || "This month";
  const topItems = items.slice(0, TOP_N);
  const tileData = toChartData(topItems);
  const fullData = toChartData(items);

  if (tileData.length === 0) {
    return (
      <Card className="flex flex-col border-0 shadow-none">
        <CardHeader className="items-center p-0 pb-0">
          <CardTitle className="text-sm font-semibold">Category Spend</CardTitle>
          <CardDescription>{period}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 px-0 pb-0 pt-4">
          <EmptyState title="No spending data" detail="Category breakdown appears when you have spend this month." />
        </CardContent>
      </Card>
    );
  }

  function openDialog() {
    setOpen(true);
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDialog();
    }
  }

  return (
    <>
      <Card
        className="flex h-full min-h-0 cursor-pointer flex-col border-0 shadow-none transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label="View all category spend"
        onClick={openDialog}
        onKeyDown={onCardKeyDown}
      >
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-sm font-semibold">Category Spend</CardTitle>
          <CardDescription>
            Top {TOP_N} · {period}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 px-0 pb-0">
          <CategoryBarChart data={tileData} className="h-full min-h-[160px]" />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg sm:max-w-2xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Category Spend</DialogTitle>
            <DialogDescription>
              All categories · {period}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div style={{ height: Math.max(fullData.length * BAR_ROW_PX, 160) }}>
              <CategoryBarChart data={fullData} className="h-full min-h-0" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
