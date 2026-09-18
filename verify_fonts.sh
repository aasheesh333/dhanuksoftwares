#!/bin/bash
# Authoritative font check on GitHub main via API (curl) with retries.
cd /data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272
OUT=$PWD/.apicheck.json

FILES="index.html privacy.html terms.html cookies.html build.mjs template.html blog-template.html apps.json lib/render-blog.mjs lib/render.mjs assets/style.css docs/admin.html docs/blog-admin.html docs/nvidia-nim-speed-test.html favicon.svg posts.json"

printf '%-38s %-9s %5s %7s %6s\n' file sha Syne DMSans Inter
for f in $FILES; do
  ok=0
  for i in 1 2 3 4; do
    curl -sS -m 30 -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/aasheesh333/dhanuksoftwares/contents/$f?ref=main" -o "$OUT"
    if grep -q '"content"' "$OUT" 2>/dev/null; then ok=1; break; fi
    sleep 5
  done
  if [ "$ok" != "1" ]; then
    printf '%-38s %-9s RATE-LIMITED/ERR\n' "$f" "--"
    continue
  fi
  python3 - "$f" "$OUT" <<'PY'
import sys, json, base64
f, p = sys.argv[1], sys.argv[2]
j = json.load(open(p))
d = base64.b64decode(j["content"]).decode("utf-8", "replace")
print("%-38s %-9s %5d %7d %6d" % (f, j["sha"][:8], d.count("Syne"), d.count("DM Sans"), d.count("Inter")))
PY
done
