#!/usr/bin/env bash
# Live smoke test for the competition-report endpoints.
#
# Fails (non-zero exit) on a non-200 response or a missing required field.
# Does not assert on specific competitor data -- that's real, changing WCA
# data -- only on the response shape and status code.
#
# Usage: scripts/smoke-report.sh
# Env overrides: CUBIFY_BASE_URL, SMOKE_COMPETITION_ID, SMOKE_WCA_ID, SMOKE_EVENTS
set -u

BASE_URL="${CUBIFY_BASE_URL:-https://cubify.in}"
COMPETITION_ID="${SMOKE_COMPETITION_ID:-CubeXWinterOpenBengaluru2026}"
WCA_ID="${SMOKE_WCA_ID:-2022RPRA01}"
EVENTS="${SMOKE_EVENTS:-333,222,444,333oh,pyram,skewb}"

fail=0

require_fields() {
  # $1 = tmp file, $2 = label, remaining = dot-paths that must be non-null/non-undefined
  local file="$1" label="$2"
  shift 2
  node -e '
    const fs = require("fs")
    const [file, ...paths] = process.argv.slice(1)
    let body
    try {
      body = JSON.parse(fs.readFileSync(file, "utf8"))
    } catch (error) {
      console.error("FAIL: response was not valid JSON:", error.message)
      process.exit(1)
    }
    const get = (obj, path) => path.split(".").reduce((value, key) => (value === null || value === undefined ? undefined : value[key]), obj)
    let missing = []
    for (const path of paths) {
      const value = get(body, path)
      if (value === undefined || value === null) missing.push(path)
    }
    if (missing.length) {
      console.error("FAIL: missing required field(s):", missing.join(", "))
      process.exit(1)
    }
  ' "$file" "$@"
}

check() {
  local name="$1" method="$2" url="$3" body="${4:-}"
  shift 4 || true
  local tmp status start end elapsed
  tmp=$(mktemp)
  start=$(date +%s%N)
  if [ -n "$body" ]; then
    status=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$body")
  else
    status=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url")
  fi
  end=$(date +%s%N)
  elapsed=$(( (end - start) / 1000000 ))
  echo "== $name: HTTP $status in ${elapsed}ms =="
  if [ "$status" != "200" ]; then
    echo "FAIL: expected HTTP 200, got $status"
    head -c 2000 "$tmp"
    echo
    fail=1
    rm -f "$tmp"
    return
  fi
  if ! require_fields "$tmp" "$name" "$@"; then
    fail=1
  fi
  rm -f "$tmp"
}

echo "Base URL: $BASE_URL"
echo "Competition: $COMPETITION_ID  WCA ID: $WCA_ID"
echo

check "GET /api/v1/agent/competition-report (no events)" GET \
  "$BASE_URL/api/v1/agent/competition-report?competitionId=$COMPETITION_ID&wcaId=$WCA_ID" "" \
  status request.eventStates source generatedAt

check "GET /api/v1/agent/competition-report (with events)" GET \
  "$BASE_URL/api/v1/agent/competition-report?competitionId=$COMPETITION_ID&wcaId=$WCA_ID&events=$EVENTS" "" \
  status request.eventStates source generatedAt

check "POST /api/v1/reports" POST "$BASE_URL/api/v1/reports" \
  "{\"competitionUrl\":\"https://www.worldcubeassociation.org/competitions/$COMPETITION_ID/registrations\",\"competitorWcaId\":\"$WCA_ID\",\"eventIds\":[\"333\",\"222\",\"444\",\"333oh\",\"pyram\",\"skewb\"]}" \
  data.byEvent data.requestedEvents source generatedAt

check "GET /api/v1/health" GET "$BASE_URL/api/v1/health" "" \
  status cubify wca generatedAt

echo
if [ "$fail" -eq 0 ]; then
  echo "All smoke checks passed."
else
  echo "One or more smoke checks FAILED."
fi
exit $fail
