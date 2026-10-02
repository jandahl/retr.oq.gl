#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

echo "pre-push: checking whitespace"
git diff --check

echo "pre-push: checking JavaScript syntax"
find . -type f -name '*.js' \
  -not -path './vendor/*' \
  -not -path './node_modules/*' \
  -not -path './.venv/*' \
  -not -path './.git/*' \
  -print0 | xargs -0 -n1 node --check

echo "pre-push: shared node tests"
node --test tests/shared/*.mjs

python_bin="python3"
if [[ -x .venv/bin/python ]]; then
  python_bin=".venv/bin/python"
fi

echo "pre-push: palette"
"$python_bin" tools/check_palette.py

echo "pre-push: checking CSS syntax"
"$python_bin" tools/check_css.py $(find . -type f -name 'style.css' \
  -not -path './vendor/*' \
  -not -path './node_modules/*' \
  -not -path './.venv/*' \
  -not -path './.git/*')

echo "pre-push: validating HTML"
npx --no-install html-validate index.html dos/index.html c64/index.html mac1984/index.html win31/index.html os2/index.html

echo "pre-push: running OS/2 smoke tests"
"$python_bin" -m pytest tests/test_os2.py -q

echo "pre-push: all checks passed"
