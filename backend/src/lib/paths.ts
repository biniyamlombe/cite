import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export function packRoot(): string {
  if (process.env.PACK_ROOT) return path.resolve(process.env.PACK_ROOT);
  return path.join(REPO_ROOT, "data", "pack");
}

export function outputsDir(): string {
  return path.join(REPO_ROOT, "outputs");
}

export function cacheDir(): string {
  return path.join(REPO_ROOT, "backend", ".cache", "extract");
}
