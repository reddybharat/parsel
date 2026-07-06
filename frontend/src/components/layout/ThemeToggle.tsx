import { Moon, Sun } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-2">
      <Sun
        className={cn("h-4 w-4", !isDark ? "font-medium text-parsel-primary" : "text-parsel-muted")}
        aria-hidden
      />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Color theme"
      />
      <Moon
        className={cn("h-4 w-4", isDark ? "font-medium text-parsel-primary" : "text-parsel-muted")}
        aria-hidden
      />
      <span className="sr-only">{isDark ? "Dark mode" : "Light mode"}</span>
    </div>
  );
}
