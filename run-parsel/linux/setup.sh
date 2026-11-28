#!/usr/bin/env bash
# Parsel setup and update for Linux (Ubuntu 24.04+, Debian 12+): gets the latest
# code, installs missing programs and packages, writes backend/.env once, and
# creates or upgrades the database. Safe to run again; that is how you update.
#
# Everything runs inside main(): bash reads scripts as it goes, and the git pull
# can replace this file mid-run. A function body is read in full before it runs.

SCRIPT="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
MIN_PYTHON_MINOR=11
MIN_NODE_MAJOR=18

fail() {
  echo
  echo "Setup did not finish. Fix the problem above, then run setup again."
  exit 1
}

find_python() {
  PYTHON=""
  for candidate in python3.13 python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1 &&
      "$candidate" -c "import sys, ensurepip; sys.exit(sys.version_info < (3, $MIN_PYTHON_MINOR))" >/dev/null 2>&1; then
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

apt_install() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "      This Linux has no apt. Install Python 3.$MIN_PYTHON_MINOR+ (python.org) and Node.js $MIN_NODE_MAJOR+ (nodejs.org), then run setup again."
    fail
  fi
  echo "      installing with apt (asks for your password)..."
  sudo apt-get update -q && sudo apt-get install -y -q python3 python3-venv python3-pip nodejs npm || fail
}

too_old() {
  echo "      $1 from apt is too old. Use Ubuntu 24.04+ / Debian 12+, or install $1 from $2, then run setup again."
  fail
}

main() {
  cd "$(dirname "$SCRIPT")/../.." || fail
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

  # ---- 1-2. Python and Node.js
  local need_apt=""
  find_python || need_apt=1
  node_ok || need_apt=1
  [ -n "$need_apt" ] && echo "[1/5] Python 3.$MIN_PYTHON_MINOR+ / Node.js $MIN_NODE_MAJOR+ ... missing" && apt_install
  find_python || too_old "Python 3.$MIN_PYTHON_MINOR+" "python.org"
  echo "[1/5] Python 3.$MIN_PYTHON_MINOR+ ... found $("$PYTHON" -c 'import platform; print(platform.python_version())')"
  node_ok || too_old "Node.js $MIN_NODE_MAJOR+" "nodejs.org"
  echo "[2/5] Node.js $MIN_NODE_MAJOR+ ... found $(node -v)"

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
  echo "  Setup finished. To use Parsel, run:"
  echo "  bash run-parsel/linux/start.sh"
  echo "============================================"
}

main "$@"
