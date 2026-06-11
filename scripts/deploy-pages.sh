#!/usr/bin/env bash
# Push the contents of ./out as the new gh-pages branch tip.
# Run after `npm run build` with GITHUB_PAGES=true.
set -euo pipefail

if [ ! -d out ]; then
  echo "out/ not found. Run: GITHUB_PAGES=true GITHUB_REPOSITORY=\"susyD1983/agency-pulse\" npm run build" >&2
  exit 1
fi

touch out/.nojekyll

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cp -R out/. "$WORK/"
cd "$WORK"
git init -q -b gh-pages
git config user.email "founding-engineer@agency-pulse.dev"
git config user.name "Agency Pulse Founding Engineer"
git add -A
git commit -q -m "Deploy static export"
git push -q --force "$(cd - >/dev/null && git remote get-url origin)" gh-pages:gh-pages

echo "Pushed gh-pages branch."
