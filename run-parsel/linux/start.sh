#!/usr/bin/env bash
# Starts Parsel: backend in the background, frontend in this terminal, then opens
# the browser. Press Ctrl+C (or close the terminal) to stop both.

cd "$(dirname "$0")/../.." || exit 1

if [ ! -x venv/bin/python ] || [ ! -d frontend/node_modules ] || [ ! -f backend/.env ]; then
  echo "Parsel is not set up yet. Run setup first (run-parsel/<your OS>/setup)."
  exit 1
fi

echo "============================================"
echo "  Parsel is starting. Your browser opens at"
echo "  http://localhost:5173 once it is ready."
echo
echo "  Keep this window open while you use Parsel."
echo "  Press Ctrl+C or close it to stop Parsel."
echo "============================================"
echo

(cd backend && exec ../venv/bin/python -m uvicorn main:app) &
BACKEND_PID=$!
venv/bin/python run-parsel/open_browser.py &
BROWSER_PID=$!
# Background jobs ignore Ctrl+C in scripts, so stop them on the way out.
trap 'kill "$BACKEND_PID" "$BROWSER_PID" 2>/dev/null' EXIT
trap 'exit 130' INT TERM HUP

# --strictPort: fail instead of silently moving to another port, so the link above stays right.
(cd frontend && npm run dev -- --strictPort)
