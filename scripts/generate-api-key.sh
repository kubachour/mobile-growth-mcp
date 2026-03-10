#!/usr/bin/env bash
set -euo pipefail

# Generate an API key for a team and insert the hash into Supabase
# Usage: ./scripts/generate-api-key.sh "Team Name" [--admin]

IS_ADMIN=false
TEAM_NAME=""

for arg in "$@"; do
  if [ "$arg" = "--admin" ]; then
    IS_ADMIN=true
  elif [ -z "$TEAM_NAME" ]; then
    TEAM_NAME="$arg"
  fi
done

if [ -z "$TEAM_NAME" ]; then
  echo "Usage: $0 \"Team Name\" [--admin]"
  exit 1
fi

# Load env vars from .env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in .env or environment)"
  exit 1
fi

# Generate raw key: me_ prefix + 32 random hex chars
RAW_KEY="me_$(openssl rand -hex 32)"

# SHA-256 hash (matches the auth.ts validation logic)
KEY_HASH=$(printf '%s' "$RAW_KEY" | openssl dgst -sha256 -hex | awk '{print $NF}')

# Insert into api_keys table via Supabase REST API
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${SUPABASE_URL}/rest/v1/api_keys" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"key_hash\": \"${KEY_HASH}\", \"team_name\": \"${TEAM_NAME}\", \"is_admin\": ${IS_ADMIN}}")

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo ""
  echo "API key generated for team: ${TEAM_NAME}$([ "$IS_ADMIN" = true ] && echo " (admin)" || true)"
  echo ""
  echo "  ${RAW_KEY}"
  echo ""
  echo "Give this key to the user. It cannot be retrieved later."
  echo ""
  echo "MCP client config:"
  echo "  {"
  echo "    \"mcpServers\": {"
  echo "      \"meta-editor\": {"
  echo "        \"url\": \"${SUPABASE_URL}/functions/v1/mcp\","
  echo "        \"headers\": {"
  echo "          \"x-api-key\": \"${RAW_KEY}\""
  echo "        }"
  echo "      }"
  echo "    }"
  echo "  }"
else
  echo "Error: Failed to insert API key (HTTP ${HTTP_STATUS})"
  exit 1
fi
