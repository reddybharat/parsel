import { Moon, Sun } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  function handleThemeChange(next: Theme) {
    setTheme(next);
  }

  return (
    <div className="flex items-center gap-2">
      <Sun
        className={cn("h-4 w-4", !isDark ? "font-medium text-parsel-primary" : "text-parsel-muted")}
        aria-hidden
      />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => {
          handleThemeChange(checked ? "dark" : "light");
        }}
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
