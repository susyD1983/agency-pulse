#!/usr/bin/env bash
# Activate the parked CI workflows once gh has the `workflow` scope.
# Prereq: run `gh auth refresh -h github.com -s workflow` first.
set -euo pipefail

if ! gh auth status 2>&1 | grep -q "workflow"; then
  echo "gh token is missing the 'workflow' scope." >&2
  echo "Run: gh auth refresh -h github.com -s workflow" >&2
  exit 1
fi

if [ ! -f docs/ci/ci.yml.pending ] || [ ! -f docs/ci/pages.yml.pending ]; then
  echo "Pending workflow files not found in docs/ci/." >&2
  exit 1
fi

mkdir -p .github/workflows
git mv docs/ci/ci.yml.pending .github/workflows/ci.yml
git mv docs/ci/pages.yml.pending .github/workflows/pages.yml
git rm docs/ci/README.md

git commit -m "ci: activate workflows

Co-Authored-By: Paperclip <noreply@paperclip.ing>"
git push

echo "Workflows activated. Watch a PR for the CI / verify check and a push to main for the Deploy to GitHub Pages run."
