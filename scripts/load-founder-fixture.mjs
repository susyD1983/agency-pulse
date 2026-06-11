#!/usr/bin/env node
// Smoke loader for fixtures/founder-case-study/*.csv.
//
// Parses each of the five v0-contract CSVs, validates required headers,
// and prints a row-count summary. Exits non-zero on missing files or
// schema errors so it can be used as a deterministic gate.
//
// Authoritative schema source: GEM-29 clarification document, answer #3,
// mirrored in fixtures/founder-case-study/README.md.
//
// No third-party deps — runs on bare Node 20+.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_DIR = resolve(process.cwd(), "fixtures/founder-case-study");

const FIXTURES = [
  {
    file: "workforce.csv",
    required: [
      "employee_id",
      "full_name",
      "department",
      "role_title",
      "employment_type",
      "start_date",
      "end_date_or_null",
      "fte_percent",
      "loaded_monthly_cost",
      "location",
      "seniority_level",
    ],
  },
  {
    file: "time-tracking.csv",
    required: [
      "entry_id",
      "employee_id",
      "date",
      "hours",
      "project_id_or_null",
      "client_id_or_null",
      "billable_flag",
      "task_category",
    ],
  },
  {
    file: "finance.csv",
    required: [
      "month",
      "department",
      "line",
      "amount",
      "currency",
      "client_id",
      "client_name",
    ],
  },
  {
    file: "pipeline.csv",
    required: [
      "opportunity_id",
      "client_id",
      "stage",
      "weighted_value",
      "expected_close_date",
      "created_date",
    ],
  },
  {
    file: "requisitions.csv",
    required: [
      "requisition_id",
      "department",
      "role",
      "status",
      "opened_date",
      "business_case_summary",
    ],
  },
];

// Minimal RFC-4180-ish CSV parser. Handles double-quoted fields, escaped
// quotes (""), and CRLF or LF line endings. Kept inline so this script has
// no install footprint and can run before `npm install` on a fresh checkout.
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function loadFixture(spec) {
  const path = resolve(FIXTURE_DIR, spec.file);
  if (!existsSync(path)) return { kind: "missing", file: spec.file };

  const text = readFileSync(path, "utf8");
  const rows = parseCsv(text);
  if (rows.length === 0) return { kind: "empty", file: spec.file };

  const header = rows[0].map((c) => c.trim());
  const missing = spec.required.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { kind: "schema_error", file: spec.file, missingColumns: missing };
  }

  return { kind: "ok", file: spec.file, rows: rows.length - 1 };
}

function main() {
  console.log(`Loading founder case-study fixtures from ${FIXTURE_DIR}\n`);

  const results = FIXTURES.map(loadFixture);
  let hardErrors = 0;

  for (const r of results) {
    switch (r.kind) {
      case "ok":
        console.log(`  ✓ ${r.file.padEnd(22)} ${r.rows.toLocaleString()} rows`);
        break;
      case "missing":
        console.log(`  · ${r.file.padEnd(22)} (not present — drop file here)`);
        break;
      case "empty":
        console.log(`  ! ${r.file.padEnd(22)} present but empty`);
        hardErrors++;
        break;
      case "schema_error":
        console.log(
          `  ✗ ${r.file.padEnd(22)} missing columns: ${r.missingColumns.join(", ")}`,
        );
        hardErrors++;
        break;
    }
  }

  const present = results.filter((r) => r.kind === "ok").length;
  console.log(`\n${present}/${FIXTURES.length} fixtures loaded cleanly.`);

  if (hardErrors > 0) {
    console.error(`\n${hardErrors} fixture(s) failed schema validation.`);
    return 1;
  }
  return 0;
}

process.exit(main());
