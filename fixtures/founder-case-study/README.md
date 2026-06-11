# Founder case-study fixture

Private ingestion path for the original COO case-study material (~150 FTE
post-production agency) that is the source of every diagnostic claim in
[`docs/AgencyPulse_strategy.md`](../../docs/AgencyPulse_strategy.md).

The CSV files in this directory are **private**. They are `.gitignore`d and
must never be committed. Only this README and `.gitkeep` are tracked.

## Where to drop files

Place the five canonical CSVs directly in this directory:

```
fixtures/founder-case-study/
├── workforce.csv
├── time-tracking.csv
├── finance.csv
├── pipeline.csv
└── requisitions.csv
```

Optional companion file (hand-authored by the COO from the restructure-proposal
numbers, used as the deterministic test oracle for the clientability-gap
diagnostic — see GEM-29 answer #5):

```
fixtures/founder-case-study/expected-diagnostic.json
```

## Smoke test

After dropping the CSVs, run:

```
npm run fixture:load
```

(equivalent to `npx tsx scripts/load-founder-fixture.ts`). The script parses
each file, validates the required columns, and prints the row count per file.
It exits non-zero if any required file is missing or any required column is
absent.

## Schemas (v0 contract)

Authoritative source: GEM-29 `clarification` document, answer #3. Reproduced
verbatim below so this directory is self-contained.

### `workforce.csv` — one row per active employment-period

| Column | Type | Notes |
| --- | --- | --- |
| `employee_id` | string | Stable id for the person within the agency |
| `full_name` | string | |
| `department` | string | |
| `role_title` | string | |
| `employment_type` | enum | `fte` \| `freelance` |
| `start_date` | date | `YYYY-MM-DD` |
| `end_date_or_null` | date \| null | `YYYY-MM-DD` or empty |
| `fte_percent` | number | 0–100 |
| `loaded_monthly_cost` | number | Fully loaded monthly cost in source currency |
| `location` | string | |
| `seniority_level` | string | |

### `time-tracking.csv` — one row per time entry

| Column | Type | Notes |
| --- | --- | --- |
| `entry_id` | string | |
| `employee_id` | string | FK → `workforce.employee_id` |
| `date` | date | `YYYY-MM-DD` |
| `hours` | number | |
| `project_id_or_null` | string \| null | |
| `client_id_or_null` | string \| null | |
| `billable_flag` | enum | `billable` \| `non_billable` \| `internal` \| `unallocated` |
| `task_category` | string | |

### `finance.csv` — one row per month per department per line

| Column | Type | Notes |
| --- | --- | --- |
| `month` | string | `YYYY-MM` |
| `department` | string | |
| `line` | enum | `revenue_recognized` \| `personnel_cost` \| `freelance_spend` \| `overhead` \| `inter_company_allocation_in` \| `inter_company_allocation_out` |
| `amount` | number | |
| `currency` | string | ISO 4217 |
| `client_id` | string \| null | Required when `line = revenue_recognized` and a per-client row is being recorded |
| `client_name` | string \| null | Same as above |

Per-month per-client revenue rows live in the same file with `line =
revenue_recognized` and `client_id` / `client_name` populated.

### `pipeline.csv` — one row per opportunity snapshot, monthly

| Column | Type | Notes |
| --- | --- | --- |
| `opportunity_id` | string | |
| `client_id` | string | |
| `stage` | string | Agency-defined stage label |
| `weighted_value` | number | |
| `expected_close_date` | date | `YYYY-MM-DD` |
| `created_date` | date | `YYYY-MM-DD` |

A stage → historical-close-rate table is a separate per-agency artifact and is
not part of this fixture.

### `requisitions.csv` — one row per open requisition

| Column | Type | Notes |
| --- | --- | --- |
| `requisition_id` | string | |
| `department` | string | |
| `role` | string | |
| `status` | enum | `open` \| `approved` \| `filled` \| `withdrawn` |
| `opened_date` | date | `YYYY-MM-DD` |
| `business_case_summary` | string | Free-text |

## Verifying with the real files

1. Drop the five CSVs into this directory.
2. Run `npm run fixture:load`.
3. Confirm the row counts match expectations and there are no schema errors.
4. (COO) Author `expected-diagnostic.json` from the restructure-proposal
   numbers. The deterministic clientability-gap test (GEM-29 answer #5) will
   consume it.
