import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { outputsDir } from "./paths.js";

export type AuditEvent = {
  ts: string;
  kind:
    | "extract_doc"
    | "extract_corpus"
    | "schema_check"
    | "quote_rejected"
    | "quote_retry"
    | "change_tests"
    | "note";
  doc_id?: string;
  source?: string;
  model?: string | null;
  rule_count?: number;
  rule_ids?: string[];
  message?: string;
  meta?: Record<string, unknown>;
};

export function auditLogPath(): string {
  return path.join(outputsDir(), "audit_log.jsonl");
}

export async function appendAudit(event: AuditEvent): Promise<void> {
  const dir = outputsDir();
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({
    ...event,
    ts: event.ts || new Date().toISOString(),
  });
  await appendFile(auditLogPath(), `${line}\n`, "utf8");
}

export async function readAuditLog(limit = 50): Promise<AuditEvent[]> {
  try {
    const raw = await readFile(auditLogPath(), "utf8");
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const events: AuditEvent[] = [];
    for (const line of lines.slice(-limit)) {
      try {
        events.push(JSON.parse(line) as AuditEvent);
      } catch {
        // skip bad lines
      }
    }
    return events.reverse();
  } catch {
    return [];
  }
}
