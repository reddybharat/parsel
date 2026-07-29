import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type NativeSelectSize = "xs" | "sm" | "default";

/** `className` applies to the wrapper (chevron positioning); use `size` for control height. */
type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: NativeSelectSize;
};

const selectSize: Record<NativeSelectSize, string> = {
  default: "h-10 px-3 py-2 pr-8 text-sm",
  sm: "h-9 px-3 py-1.5 pr-8 text-xs",
  xs: "h-7 px-2 py-0 pr-6 text-xs",
};

const chevronSize: Record<NativeSelectSize, string> = {
  default: "size-4 right-2.5",
  sm: "size-4 right-2.5",
  xs: "size-3.5 right-1.5",
};

function NativeSelect({ className, size = "default", ...props }: NativeSelectProps) {
  return (
    <div
      className={cn("group/native-select relative w-full has-[select:disabled]:opacity-50", className)}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "flex w-full min-w-0 appearance-none rounded-none border border-input bg-background shadow-none transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          selectSize[size],
        )}
        {...props}
      />
      <ChevronDown
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          chevronSize[size],
        )}
        aria-hidden
      />
    </div>
  );
}

function NativeSelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" className={cn(className)} {...props} />;
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" className={cn(className)} {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
