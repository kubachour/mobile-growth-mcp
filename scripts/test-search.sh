#!/usr/bin/env bash
set -euo pipefail

JQ="$HOME/.local/bin/jq"
if ! command -v "$JQ" &>/dev/null; then
  JQ="jq"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env file not found at $ENV_FILE" >&2
  exit 1
fi

# Load SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" || ! "$line" == *=* ]] && continue
  key="${line%%=*}"
  key="${key%"${key##*[![:space:]]}"}"
  value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%\"}"
  value="${value#\"}"
  case "$key" in
    SUPABASE_URL) SUPABASE_URL="$value" ;;
    SUPABASE_SERVICE_ROLE_KEY) SUPABASE_SERVICE_ROLE_KEY="$value" ;;
  esac
done < "$ENV_FILE"

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env" >&2
  exit 1
fi

# Parse arguments
QUERY=""
LIMIT=""
TOPICS=""
APPLIES_TO=""
RAW=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --topics)
      TOPICS="$2"
      shift 2
      ;;
    --applies-to)
      APPLIES_TO="$2"
      shift 2
      ;;
    --raw)
      RAW=true
      shift
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: test-search.sh <query> [options]

Options:
  --limit N          Max results (default: 10, max: 30)
  --topics '["x"]'   Filter by topics array
  --applies-to '["x"]' Filter by applies_to array
  --raw              Show full JSON response
  -h, --help         Show this help

Examples:
  ./scripts/test-search.sh "creative testing strategy"
  ./scripts/test-search.sh "web to app funnels" --limit 5
  ./scripts/test-search.sh "signal engineering" --topics '["scaling"]'
  ./scripts/test-search.sh "budget optimization" --raw
USAGE
      exit 0
      ;;
    *)
      if [[ -z "$QUERY" ]]; then
        QUERY="$1"
      else
        echo "Error: unexpected argument '$1'" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$QUERY" ]]; then
  echo "Error: query argument required. Usage: test-search.sh \"your query\"" >&2
  exit 1
fi

# Build JSON body
BODY=$($JQ -n \
  --arg query "$QUERY" \
  --argjson limit "${LIMIT:-null}" \
  --argjson topics "${TOPICS:-null}" \
  --argjson applies_to "${APPLIES_TO:-null}" \
  '{query: $query} +
   (if $limit != null then {limit: $limit} else {} end) +
   (if $topics != null then {topics: $topics} else {} end) +
   (if $applies_to != null then {applies_to: $applies_to} else {} end)')

echo "Searching: \"$QUERY\""
[[ -n "$LIMIT" ]] && echo "Limit: $LIMIT"
[[ -n "$TOPICS" ]] && echo "Topics: $TOPICS"
[[ -n "$APPLIES_TO" ]] && echo "Applies to: $APPLIES_TO"
echo "---"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${SUPABASE_URL}/functions/v1/search" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "$BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY_RESPONSE=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Error (HTTP $HTTP_CODE):" >&2
  echo "$BODY_RESPONSE" | $JQ . 2>/dev/null || echo "$BODY_RESPONSE" >&2
  exit 1
fi

if [[ "$RAW" == "true" ]]; then
  echo "$BODY_RESPONSE" | $JQ .
else
  COUNT=$(echo "$BODY_RESPONSE" | $JQ '.count')
  echo "Results: $COUNT"
  echo ""
  echo "$BODY_RESPONSE" | $JQ -r '.results[] | "[\(.score | tostring | .[0:6])] \(.slug)\n  \(.title)\n  topics: \(.topics // [] | join(", "))\n"'
fi
