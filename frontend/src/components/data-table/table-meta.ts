import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right";
    width?: string;
    skeletonWidth?: string;
    label?: string;
  }
}
