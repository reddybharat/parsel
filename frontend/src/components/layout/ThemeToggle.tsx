import { Moon, Sun } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, updateProfile } = useAuth();
  const isDark = theme === "dark";

  async function handleThemeChange(next: Theme) {
    setTheme(next);
    if (!isAuthenticated) return;
    try {
      await updateProfile({ preferences: { theme: next } });
    } catch {
      // Local theme already applied; server sync can retry on next settings save.
    }
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
          void handleThemeChange(checked ? "dark" : "light");
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
