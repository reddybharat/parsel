import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function SessionExpiryDialog({
  open,
  expiresAt,
  extending,
  onStayLoggedIn,
  onLogout,
}: {
  open: boolean;
  expiresAt: number | null;
  extending: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!open || expiresAt == null) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [open, expiresAt]);

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-sm sm:rounded-none"
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Still there?
          </DialogTitle>
          <DialogDescription>
            Your session expires in{" "}
            <span className="font-medium text-foreground tabular-nums">{secondsLeft}s</span>.
            Stay logged in to continue, or you will be signed out.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            className="flex-1"
            type="button"
            onClick={onStayLoggedIn}
            disabled={extending || secondsLeft <= 0}
          >
            {extending ? "Extending..." : "Stay logged in"}
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            type="button"
            onClick={onLogout}
            disabled={extending}
          >
            Log out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
