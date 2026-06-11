# CI / Pages — temporary state

The `.github/workflows/` directory is intentionally empty in the initial
bootstrap. The GitHub OAuth token used to push this repo is missing the
`workflow` scope, so workflow files are rejected by GitHub on push.

Until that is fixed, the workflows live here in `docs/ci/` as `.pending`
files so reviewers can read them, and the GitHub Pages site is deployed by
pushing the static build artifact directly to the `gh-pages` branch from a
trusted local machine.

## To install the workflows

One of:

1. **Grant the missing scope** to the `gh` CLI used by the founding engineer's
   environment, then move the files:
   ```
   gh auth refresh -h github.com -s workflow
   mkdir -p .github/workflows
   git mv docs/ci/ci.yml.pending .github/workflows/ci.yml
   git mv docs/ci/pages.yml.pending .github/workflows/pages.yml
   git rm docs/ci/README.md
   ```
2. **Or upload via the GitHub web UI**: copy each `.pending` file into
   `.github/workflows/` via the file editor, drop the `.pending` suffix, and
   delete this README.

Either path needs to happen before CI/preview deploys become automatic.

## How the placeholder site is deployed today

Run the helper script from a clean working tree on `main`:

```
GITHUB_REPOSITORY="susyD1983/agency-pulse" GITHUB_PAGES=true npm run build
scripts/deploy-pages.sh
```

The script builds the static export and force-pushes the result to the
`gh-pages` branch. GitHub Pages is configured to serve from that branch.
