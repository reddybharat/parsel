import { useEffect, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type FeedbackMessage = {
  variant: "success" | "info" | "error";
  title: string;
  description?: string;
};

const DISMISS_MS = 5000;

const variantConfig = {
  success: {
    icon: CheckCircle2,
    alertVariant: "default" as const,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950 [&>svg]:text-emerald-600",
  },
  info: {
    icon: Info,
    alertVariant: "default" as const,
    className: "border-blue-200 bg-blue-50 text-blue-950 [&>svg]:text-blue-600",
  },
  error: {
    icon: AlertCircle,
    alertVariant: "destructive" as const,
    className: undefined,
  },
};

export function StatusAlert({
  variant,
  title,
  description,
  action,
  onDismiss,
  dismissMs = DISMISS_MS,
}: FeedbackMessage & {
  action?: ReactNode;
  onDismiss?: () => void;
  dismissMs?: number;
}) {
  const { icon: Icon, alertVariant, className } = variantConfig[variant];

  useEffect(() => {
    if (!onDismiss) return;
    const timer = window.setTimeout(onDismiss, dismissMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, dismissMs, title, description, variant]);

  return (
    <Alert variant={alertVariant} className={cn(className, action && "flex items-start justify-between gap-3")}>
      <div className="min-w-0 flex-1">
        <div className={cn("flex gap-2", description ? "items-start" : "items-center")}>
          <Icon className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <AlertTitle className="mb-0">{title}</AlertTitle>
            {description ? <AlertDescription className="mt-1 whitespace-pre-line">{description}</AlertDescription> : null}
          </div>
        </div>
      </div>
      {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
    </Alert>
  );
}
