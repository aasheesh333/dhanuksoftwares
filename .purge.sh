CACHE=/data/data/com.dhanuk.ovidai/files/sandbox/home/repo/dhanuksoftwares-main
WS=/data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272

echo "=== cache hidden files BEFORE cleanup ==="
ls -a1 "$CACHE" | grep '^\.' || echo "(none)"

echo "=== removing scratch from cache + workspace ==="
for f in .chk.sh .clean.sh .verify.sh .audit.sh .sync.sh .commitlog.sh; do
  rm -f "$CACHE/$f" "$WS/$f"
done
rm -rf "$CACHE/.cmp" "$WS/.cmp" "$WS/__pycache__"

echo "=== cache hidden files AFTER cleanup ==="
ls -a1 "$CACHE" | grep '^\.' || echo "(none)"

echo "=== workspace hidden AFTER cleanup ==="
ls -a1 "$WS" | grep '^\.' || echo "(none)"

echo "=== .gitignore in cache ==="
cat "$CACHE/.gitignore"
