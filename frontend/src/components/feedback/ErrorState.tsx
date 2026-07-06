import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="whitespace-pre-line">{message}</AlertDescription>
      </div>
      {onRetry ? (
        <Button className="shrink-0" size="sm" variant="outline" onClick={onRetry} type="button">
          Retry
        </Button>
      ) : null}
    </Alert>
  );
}
