/**
 * Rule version history for GET /rules/:id/versions.
 *
 * Stable keys survive team_rule_id renumbering (alias_id, else source_doc+citation+title).
 * History is persisted in outputs/rule_versions.json — newest version first.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { RuleRecord } from "@rhl/shared";
import { readJsonIfExists, writeJson } from "./io.js";
import { outputsDir, REPO_ROOT } from "./paths.js";

const execFileAsync = promisify(execFile);

export type RuleVersion = {
  version: string;
  corpus_release: string;
  released_at: string;
  status: RuleRecord["status"];
  quoted_span: string;
  change_note: string;
};

export type RuleVersionsFile = {
  generated_at: string;
  by_key: Record<string, RuleVersion[]>;
};

type ChronEntry = {
  released_at: string;
  status: RuleRecord["status"];
  quoted_span: string;
  effective_date: string | null | undefined;
  requirement: string;
  noteHint?: string;
};

export function versionsPath(): string {
  return path.join(outputsDir(), "rule_versions.json");
}

export function stableRuleKey(rule: RuleRecord): string {
  if (rule.alias_id) return `alias:${rule.alias_id}`;
  const cite = (rule.citation || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const title = (rule.title || "").toLowerCase().trim().slice(0, 60);
  const doc = rule.source_doc_id || "nodoc";
  return `doc:${doc}|${cite}|${title}`;
}

function corpusRelease(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}.${m[2]}`;
  return isoDate.slice(0, 7).replace("-", ".");
}

function materialChange(a: ChronEntry, b: ChronEntry): boolean {
  return a.status !== b.status || a.quoted_span !== b.quoted_span;
}

function changeNote(prev: ChronEntry | null, next: ChronEntry): string {
  if (!prev) return "Initial extraction from capturable corpus text.";
  const bits: string[] = [];
  if (prev.status !== next.status) {
    bits.push(`status ${prev.status} → ${next.status}`);
  }
  if ((prev.effective_date ?? "") !== (next.effective_date ?? "")) {
    bits.push(
      `effective_date ${prev.effective_date ?? "∅"} → ${next.effective_date ?? "∅"}`,
    );
  }
  if (prev.quoted_span !== next.quoted_span) {
    bits.push("quoted_span updated (re-extract or span repair)");
  }
  if (!bits.length && next.noteHint) return next.noteHint;
  return bits.length
    ? bits.join("; ")
    : "Record refreshed with no material field change.";
}

function entryFromRule(
  rule: RuleRecord,
  releasedAt: string,
  noteHint?: string,
): ChronEntry {
  return {
    released_at: releasedAt.slice(0, 10),
    status: rule.status,
    quoted_span: rule.quoted_span,
    effective_date: rule.effective_date,
    requirement: rule.requirement || "",
    noteHint,
  };
}

function chronToVersionsNewestFirst(chron: ChronEntry[]): RuleVersion[] {
  const versions: RuleVersion[] = [];
  for (let i = 0; i < chron.length; i++) {
    const cur = chron[i]!;
    const prev = i > 0 ? chron[i - 1]! : null;
    versions.push({
      version: "tmp",
      corpus_release: corpusRelease(cur.released_at),
      released_at: cur.released_at,
      status: cur.status,
      quoted_span: cur.quoted_span,
      change_note: changeNote(prev, cur),
    });
  }
  // newest first
  versions.reverse();
  const n = versions.length;
  return versions.map((v, i) => ({ ...v, version: `v${n - i}` }));
}

function appendIfChanged(
  chron: ChronEntry[],
  next: ChronEntry,
): void {
  const last = chron[chron.length - 1];
  if (last && !materialChange(last, next) && last.released_at === next.released_at) {
    return;
  }
  if (last && !materialChange(last, next)) {
    // Same content on a later date — keep first sighting only
    return;
  }
  chron.push(next);
}

export async function loadRuleVersionsFile(): Promise<RuleVersionsFile> {
  const file = await readJsonIfExists<RuleVersionsFile>(versionsPath());
  return (
    file ?? {
      generated_at: new Date().toISOString(),
      by_key: {},
    }
  );
}

export async function saveRuleVersionsFile(
  file: RuleVersionsFile,
): Promise<void> {
  file.generated_at = new Date().toISOString();
  await writeJson(versionsPath(), file);
}

export function versionsForRule(
  file: RuleVersionsFile,
  rule: RuleRecord,
): RuleVersion[] {
  const key = stableRuleKey(rule);
  return file.by_key[key] || [];
}

/**
 * Merge current rules into an existing versions file (newest-first lists).
 * Prepends a version when status/quoted_span changed.
 */
export async function recordCurrentRuleVersions(
  rules: RuleRecord[],
  opts?: { releasedAt?: string },
): Promise<RuleVersionsFile> {
  const file = await loadRuleVersionsFile();
  const releasedAt = (opts?.releasedAt || new Date().toISOString()).slice(0, 10);
  const byKey = { ...file.by_key };

  for (const rule of rules) {
    const key = stableRuleKey(rule);
    const existingNewestFirst = byKey[key] || [];
    // Convert to chron (oldest first) for append helper
    const chron: ChronEntry[] = [...existingNewestFirst]
      .reverse()
      .map((v) => ({
        released_at: v.released_at,
        status: v.status,
        quoted_span: v.quoted_span,
        effective_date: rule.effective_date,
        requirement: rule.requirement || "",
      }));
    appendIfChanged(chron, entryFromRule(rule, releasedAt));
    byKey[key] = chronToVersionsNewestFirst(chron);
  }

  const out: RuleVersionsFile = {
    generated_at: new Date().toISOString(),
    by_key: byKey,
  };
  await saveRuleVersionsFile(out);
  return out;
}

async function gitLogRulesJson(): Promise<
  { sha: string; date: string; subject: string }[]
> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--format=%H%x09%cI%x09%s", "--", "outputs/rules.json"],
      { cwd: REPO_ROOT, maxBuffer: 2 * 1024 * 1024 },
    );
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, date, ...rest] = line.split("\t");
        return { sha: sha!, date: date!, subject: rest.join("\t") };
      });
  } catch {
    return [];
  }
}

async function gitShowRules(sha: string): Promise<RuleRecord[] | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["show", `${sha}:outputs/rules.json`],
      { cwd: REPO_ROOT, maxBuffer: 20 * 1024 * 1024 },
    );
    const parsed = JSON.parse(stdout) as { rules?: RuleRecord[] };
    return parsed.rules ?? null;
  } catch {
    return null;
  }
}

/**
 * Rebuild version history from git commits of outputs/rules.json, then overlay
 * the current working-tree rules as the tip. Writes outputs/rule_versions.json.
 */
export async function buildVersionsFromGit(
  currentRules: RuleRecord[],
): Promise<RuleVersionsFile> {
  const commits = await gitLogRulesJson();
  const chronological = [...commits].reverse(); // oldest → newest

  const chronByKey: Record<string, ChronEntry[]> = {};

  for (const c of chronological) {
    const rules = await gitShowRules(c.sha);
    if (!rules?.length) continue;
    const date = c.date.slice(0, 10);
    for (const rule of rules) {
      const key = stableRuleKey(rule);
      const chron = chronByKey[key] || (chronByKey[key] = []);
      appendIfChanged(
        chron,
        entryFromRule(rule, date, c.subject.slice(0, 80)),
      );
    }
  }

  const tipDate = new Date().toISOString().slice(0, 10);
  for (const rule of currentRules) {
    const key = stableRuleKey(rule);
    const chron = chronByKey[key] || (chronByKey[key] = []);
    appendIfChanged(chron, entryFromRule(rule, tipDate));
  }

  const by_key: Record<string, RuleVersion[]> = {};
  for (const [key, chron] of Object.entries(chronByKey)) {
    by_key[key] = chronToVersionsNewestFirst(chron);
  }

  const file: RuleVersionsFile = {
    generated_at: new Date().toISOString(),
    by_key,
  };
  await saveRuleVersionsFile(file);
  return file;
}
