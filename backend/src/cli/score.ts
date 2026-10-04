/**
 * Run organizer score.py when present.
 * Pack variant participant-final-no-hour16 ships without score.py — this CLI
 * is the drop-in path once organizers release it.
 *
 * Places checked (first hit wins):
 *   $SCORE_PY
 *   data/pack/score.py
 *   data/pack/dev/score.py
 *   ./score.py
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { packRoot, outputsDir, REPO_ROOT } from "../lib/paths.js";

function findScorePy(): string | null {
  const fromEnv = process.env.SCORE_PY?.trim();
  if (fromEnv && existsSync(fromEnv)) return path.resolve(fromEnv);

  const candidates = [
    path.join(packRoot(), "score.py"),
    path.join(packRoot(), "dev", "score.py"),
    path.join(packRoot(), "scoring", "score.py"),
    path.join(REPO_ROOT, "score.py"),
    path.join(REPO_ROOT, "data", "pack", "score.py"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Last resort: any score.py under pack root (shallow)
  try {
    const pack = packRoot();
    for (const name of readdirSync(pack)) {
      if (name === "score.py") return path.join(pack, name);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function runPython(scorePy: string, args: string[]): number | null {
  const result = spawnSync("python3", [scorePy, ...args], {
    stdio: "inherit",
    cwd: path.dirname(scorePy),
    env: {
      ...process.env,
      CITE_OUTPUTS: outputsDir(),
      OUTPUTS_DIR: outputsDir(),
      RULES_JSON: path.join(outputsDir(), "rules.json"),
      LOOKUPS_JSON: path.join(outputsDir(), "lookups.json"),
      CHANGES_JSON: path.join(outputsDir(), "changes.json"),
    },
  });
  return result.status;
}

function printReadiness(): void {
  const out = outputsDir();
  console.log("");
  console.log("Grading readiness (no score.py yet):");
  console.log(`  outputs: ${out}`);
  for (const f of ["rules.json", "lookups.json", "changes.json"]) {
    const p = path.join(out, f);
    console.log(`  ${existsSync(p) ? "✓" : "✗"} ${f}`);
  }
  console.log("");
  console.log("When organizers ship score.py:");
  console.log("  1. Copy it to data/pack/score.py  (or set SCORE_PY=/path/to/score.py)");
  console.log("  2. npm run score");
  console.log("  Optional: npm run submission:check  # T1–T5 + citations + 500 lookups");
}

function main() {
  const scorePy = findScorePy();
  if (!scorePy) {
    console.log(
      "score.py not found (expected for the no-hour16 / no-scoring pack).",
    );
    printReadiness();
    process.exit(0);
  }

  const out = outputsDir();
  console.log(`Running organizer score.py`);
  console.log(`  script:  ${scorePy}`);
  console.log(`  outputs: ${out}`);

  // Try common organizer CLI shapes in order.
  const attempts: string[][] = [
    ["--outputs", out],
    ["--output-dir", out],
    ["--outdir", out],
    [out],
    [],
  ];

  for (const args of attempts) {
    console.log(
      args.length
        ? `Attempt: python3 score.py ${args.join(" ")}`
        : "Attempt: python3 score.py",
    );
    const status = runPython(scorePy, args);
    if (status === 0) {
      console.log("score.py completed successfully.");
      process.exit(0);
    }
  }

  console.error("score.py failed under all known argument shapes.");
  console.error("Inspect the script header for the expected CLI, then re-run.");
  process.exit(1);
}

main();
