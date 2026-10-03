import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

export async function readCsv<T extends Record<string, string>>(
  filePath: string,
): Promise<T[]> {
  const raw = await readFile(filePath, "utf8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as T[];
}
