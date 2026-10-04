import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");

function run(script: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["tsx", path.join(backendRoot, "src/cli", script), ...args],
      {
        cwd: backendRoot,
        stdio: "inherit",
        env: process.env,
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited ${code}`));
    });
  });
}

async function main() {
  const heuristicGeo = process.argv.includes("--heuristic-geo");
  console.log("=== 0/7 Schema shape gate ===");
  await run("check_schema.ts");
  console.log("=== 1/7 Extract ===");
  await run("extract.ts");
  console.log("=== 2/7 Enrich dual coverage ===");
  await run("enrich_coverage.ts");
  console.log("=== 3/7 Rule version history ===");
  await run("build_versions.ts");
  console.log("=== 4/7 Geocode ===");
  await run("geocode.ts", heuristicGeo ? ["--heuristic-only"] : []);
  console.log("=== 5/7 Lookup ===");
  await run("lookup.ts");
  console.log("=== 6/7 Changes ===");
  await run("changes.ts");
  console.log("=== stretch/Santa Ana (optional demo jurisdiction) ===");
  await run("stretch.ts", heuristicGeo ? ["--heuristic-geo"] : []);
  console.log("=== Verify generated artifacts and refresh offline snapshots ===");
  await run("run_tests.ts");
  await run("demo_snapshots.ts");
  console.log("Pipeline complete → outputs/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
