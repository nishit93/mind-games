#!/usr/bin/env bash
# Checks that the website and its progress server are healthy, and exits with 1 if anything is wrong.
# Run by the "Health check" GitHub workflow every 20 minutes; you can also run it yourself: bash tools/monitor.sh
# It only reads public addresses and never creates or changes anything on the server.
set -u

SITE="${SITE_URL:-https://nishit93.github.io/mind-games/}"
API="${API_URL:-https://mindgames-api.duckdns.org}"
ORIGIN="${SITE_ORIGIN:-https://nishit93.github.io}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
failed=0

problem() { echo "PROBLEM: $*"; failed=1; }
fine() { echo "ok: $*"; }
get() { curl -s --max-time 20 --retry 2 --retry-delay 5 --retry-all-errors "$@"; }

# 1. The website loads and is the real home page.
code=$(get -o "$TMP/home.html" -w '%{http_code}' "$SITE")
if [ "$code" = 200 ] && grep -q 'id="view"' "$TMP/home.html"; then fine "website home page"; else problem "website home page answered HTTP $code"; fi

# 2. The game list and one game page load.
code=$(get -o "$TMP/games.js" -w '%{http_code}' "${SITE}games.js")
if [ "$code" = 200 ] && grep -q 'var GAMES' "$TMP/games.js"; then fine "game list"; else problem "game list answered HTTP $code"; fi
code=$(get -o /dev/null -w '%{http_code}' "${SITE}games/sudoku/")
[ "$code" = 200 ] && fine "a game page" || problem "game page answered HTTP $code"

# 3. The progress server answers.
body=$(get "$API/v1/health")
case "$body" in *'"ok":true'*) fine "progress server health" ;; *) problem "progress server health said: ${body:-nothing}" ;; esac

# 3b. Backups keep happening: the newest local backup and the last off-server upload must be under 36 hours old.
# (An older server that does not report ages, or off-server backup not set up yet, is noted but is not a problem.)
age_of() { echo "$body" | sed -n "s/.*\"$1\":\([0-9.]*\).*/\1/p"; }
for field in backupAgeHours offsiteAgeHours; do
  label="nightly backup"; [ "$field" = offsiteAgeHours ] && label="off-server backup"
  age=$(age_of "$field")
  if [ -z "$age" ]; then echo "note: no $label reported yet"
  elif awk "BEGIN{exit !($age < 36)}"; then fine "$label is $age hours old"
  else problem "$label is $age hours old (should be under 36)"; fi
done

# 4. The website is allowed to talk to the server (browser access rules).
code=$(get -o /dev/null -w '%{http_code}' -X OPTIONS -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: POST" "$API/v1/sync")
[ "$code" = 204 ] && fine "website may call the server" || problem "browser access check answered HTTP $code (expected 204)"

# 5. The HTTPS certificate is not about to expire. It renews itself at 30 days left, so under 14 means renewal is broken.
host="${API#https://}"
if echo | openssl s_client -connect "$host:443" -servername "$host" 2>/dev/null | openssl x509 -noout -checkend $((14 * 86400)) >/dev/null 2>&1; then
  fine "certificate valid for at least 14 more days"
else
  problem "certificate for $host is missing, expired or expires within 14 days"
fi

if [ "$failed" = 0 ]; then echo "All checks passed."; else echo "Something needs attention."; fi
exit "$failed"
