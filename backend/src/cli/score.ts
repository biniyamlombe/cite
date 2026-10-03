/**
 * Run organizer score.py when present (hour-16 / scoring pack).
 * No-op with clear messaging for the no-hour16 pack variant.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { packRoot, outputsDir, REPO_ROOT } from "../lib/paths.js";

function findScorePy(): string | null {
  const candidates = [
    path.join(packRoot(), "score.py"),
    path.join(packRoot(), "dev", "score.py"),
    path.join(REPO_ROOT, "score.py"),
    path.join(REPO_ROOT, "data", "pack", "score.py"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function main() {
  const scorePy = findScorePy();
  if (!scorePy) {
    console.log(
      "score.py not found (expected for participant-final-no-hour16 pack).",
    );
    console.log(
      "When organizers ship score.py, place it under data/pack/ (or packRoot) and re-run: npm run score",
    );
    console.log(`Outputs ready at ${outputsDir()}`);
    process.exit(0);
  }

  const out = outputsDir();
  console.log(`Running ${scorePy} against ${out}`);
  const result = spawnSync("python3", [scorePy, "--outputs", out], {
    stdio: "inherit",
    cwd: path.dirname(scorePy),
  });
  // Some score scripts take positional args or none — retry bare if flagged unknown
  if (result.status !== 0 && result.status !== null) {
    console.log("Retrying score.py without --outputs flag…");
    const retry = spawnSync("python3", [scorePy], {
      stdio: "inherit",
      cwd: path.dirname(scorePy),
      env: { ...process.env, CITE_OUTPUTS: out, OUTPUTS_DIR: out },
    });
    process.exit(retry.status ?? 1);
  }
  process.exit(result.status ?? 0);
}

main();
