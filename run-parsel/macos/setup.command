#!/usr/bin/env bash
# Parsel setup and update for macOS (double-click opens Terminal): gets the latest
# code, installs missing programs with Homebrew and packages, writes backend/.env
# once, and creates or upgrades the database. Safe to run again; that is how you update.
#
# Everything runs inside main(): bash reads scripts as it goes, and the git pull
# can replace this file mid-run. A function body is read in full before it runs.

SCRIPT="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
MIN_PYTHON_MINOR=11
MIN_NODE_MAJOR=18
BREW_PYTHON="python@3.12"

fail() {
  echo
  echo "Setup did not finish. Fix the problem above, then double-click setup.command again."
  exit 1
}

find_python() {
  PYTHON=""
  for candidate in python3.13 python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1 &&
      "$candidate" -c "import sys; sys.exit(sys.version_info < (3, $MIN_PYTHON_MINOR))" >/dev/null 2>&1; then
      PYTHON="$candidate"
      return 0
    fi
  done
  return 1
}

node_ok() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 &&
    [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null
}

load_brew() {
  # A fresh Terminal may not have Homebrew on PATH yet.
  for brew in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$brew" ] && eval "$("$brew" shellenv)" && return 0
  done
  command -v brew >/dev/null 2>&1
}

brew_install() {
  if ! load_brew; then
    echo "      Homebrew is needed to install $1. Install it by following https://brew.sh"
    echo "      (paste the one command shown there into Terminal), then double-click setup.command again."
    fail
  fi
  echo "      installing $1 with Homebrew..."
  brew install "$1" || fail
}

main() {
  cd "$(dirname "$SCRIPT")/../.." || fail
  load_brew
  echo "============================================"
  echo "  Parsel setup"
  echo "============================================"
  echo

  # ---- 0. Latest code
  if [ "$1" = "--pulled" ]; then
    echo "[0/5] Latest code ... updated"
  elif [ ! -d .git ]; then
    echo "[0/5] Latest code ... skipped: not a git download. To update, download the new version and copy the data folder into it."
  elif ! command -v git >/dev/null 2>&1; then
    echo "[0/5] Latest code ... skipped: git is not installed, so updates can't be downloaded."
  elif [ "$(git rev-parse --abbrev-ref HEAD)" != "release" ]; then
    echo "[0/5] Latest code ... skipped: this copy is on branch \"$(git rev-parse --abbrev-ref HEAD)\", updates come from \"release\"."
  else
    echo "[0/5] Latest code ..."
    if ! git pull --ff-only origin release; then
      echo
      echo "Could not update the code; git's message is above. Usually this means files in"
      echo "this folder were edited. Undo those edits (or ask for help), then run setup again."
      echo "Your data was not touched."
      exit 1
    fi
    exec bash "$SCRIPT" --pulled
  fi

  # ---- 1. Python
  if find_python; then
    echo "[1/5] Python 3.$MIN_PYTHON_MINOR+ ... found $("$PYTHON" -c 'import platform; print(platform.python_version())')"
  else
    echo "[1/5] Python 3.$MIN_PYTHON_MINOR+ ... not found"
    brew_install "$BREW_PYTHON"
    find_python || { echo "      Python still not found; install it from python.org."; fail; }
    echo "      installed $("$PYTHON" -c 'import platform; print(platform.python_version())')"
  fi

  # ---- 2. Node.js
  if node_ok; then
    echo "[2/5] Node.js $MIN_NODE_MAJOR+ ... found $(node -v)"
  else
    echo "[2/5] Node.js $MIN_NODE_MAJOR+ ... not found"
    brew_install node
    node_ok || { echo "      Node.js still not found; install it from nodejs.org."; fail; }
    echo "      installed $(node -v)"
  fi

  # ---- 3. Backend packages
  echo "[3/5] Backend packages (can take a few minutes the first time) ..."
  [ -x venv/bin/python ] || "$PYTHON" -m venv venv || fail
  venv/bin/python -m pip install --disable-pip-version-check -q -r backend/requirements.txt || fail
  echo "      up to date"

  # ---- 4. Frontend packages
  echo "[4/5] Frontend packages ..."
  (cd frontend && npm install --no-audit --no-fund --loglevel=error) || fail
  echo "      up to date"

  # ---- 5. Settings and database
  echo "[5/5] Settings and database ..."
  venv/bin/python run-parsel/configure.py || fail

  echo
  echo "============================================"
  echo "  Setup finished. To use Parsel, double-click"
  echo "  run-parsel/macos/start.command"
  echo "============================================"
}

main "$@"
