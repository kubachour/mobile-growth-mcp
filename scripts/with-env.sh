#!/usr/bin/env bash
# Loads .env from repo root, then execs the given command with that environment.
# Lets allowlist rules match `./scripts/*` instead of the compound `set -a; ...; <cmd>`.
#
# Usage:  ./scripts/with-env.sh <command> [args...]
#   e.g.  ./scripts/with-env.sh python3 -c "import os; print(os.environ['SUPABASE_URL'])"
#         ./scripts/with-env.sh curl -sS "$SUPABASE_URL/rest/v1/insights?select=id&limit=1"

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
env_file="$repo_root/.env"

if [[ ! -f "$env_file" ]]; then
  echo "with-env.sh: .env not found at $env_file" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

exec "$@"
