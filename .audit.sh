CACHE=/data/data/com.dhanuk.ovidai/files/sandbox/home/repo/dhanuksoftwares-main
WS=/data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272
cd "$WS"
mkdir -p .cmp

echo "=== comparing every cache file vs GitHub main ==="
cd "$CACHE"
find . -type f -not -path "./.git/*" | sed 's|^\./||' | sort | while read -r f; do
  R="$WS/.cmp/remote_$(echo "$f" | tr / _)"
  code=$(curl -sS -H "Accept: application/vnd.github.raw" -w "%{http_code}" \
    "https://api.github.com/repos/aasheesh333/dhanuksoftwares/contents/$f?ref=main" -o "$R")
  if [ "$code" = "200" ]; then
    if cmp -s "$f" "$R"; then echo "SAME    $f"; else echo "STALE   $f"; fi
  else
    echo "MISSING $f (http $code) — exists in cache only"
  fi
done
