#!/bin/zsh
set -e
cd "$(dirname "$0")"
echo "Typecheck"
npx tsc --noEmit
echo "Unit tests"
npm test --silent
echo "UI tests (chromium + webkit)"
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest e2e/test_ui.py -q
echo "All good."
