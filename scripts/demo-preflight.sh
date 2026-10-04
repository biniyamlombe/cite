#!/usr/bin/env bash
# Read-only semantic checks, not merely HTTP availability.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node --import tsx backend/src/cli/preflight.ts
