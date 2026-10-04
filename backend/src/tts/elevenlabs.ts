/**
 * ElevenLabs synthesis with disk cache and hard character budget.
 * Clients never supply free-form text — only server-built briefings.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../lib/paths.js";

const API = "https://api.elevenlabs.io/v1";
const VOICE = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const BUDGET = Number(process.env.ELEVENLABS_TTS_BUDGET || 8000);
const CACHE_DIR =
  process.env.CITE_TTS_DIR || path.join(REPO_ROOT, "backend", ".cache", "tts");

type BudgetFile = { spent: number };

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function hashKey(text: string): string {
  return crypto.createHash("sha256").update(`${MODEL}|${VOICE}|${text}`).digest("hex");
}

async function readBudget(): Promise<BudgetFile> {
  try {
    const raw = await fs.readFile(path.join(CACHE_DIR, "budget.json"), "utf8");
    return JSON.parse(raw) as BudgetFile;
  } catch {
    return { spent: 0 };
  }
}

async function writeBudget(b: BudgetFile) {
  await fs.writeFile(path.join(CACHE_DIR, "budget.json"), JSON.stringify(b), "utf8");
}

export async function synthesizeBriefing(
  text: string,
): Promise<
  | { ok: true; audio: Buffer; cached: boolean; chars: number }
  | { ok: false; reason: string; text: string }
> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { ok: false, reason: "missing_key", text };

  const clipped = text.slice(0, 1000);
  await ensureCacheDir();
  const hash = hashKey(clipped);
  const mp3Path = path.join(CACHE_DIR, `${hash}.mp3`);
  try {
    const audio = await fs.readFile(mp3Path);
    return { ok: true, audio, cached: true, chars: clipped.length };
  } catch {
    // synthesize
  }

  const budget = await readBudget();
  if (budget.spent + clipped.length > BUDGET) {
    return { ok: false, reason: "budget", text: clipped };
  }

  const url = `${API}/text-to-speech/${VOICE}?output_format=mp3_44100_64`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: clipped,
      model_id: MODEL,
    }),
  });
  if (!res.ok) {
    return { ok: false, reason: `http_${res.status}`, text: clipped };
  }
  const audio = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(mp3Path, audio);
  budget.spent += clipped.length;
  await writeBudget(budget);
  return { ok: true, audio, cached: false, chars: clipped.length };
}
