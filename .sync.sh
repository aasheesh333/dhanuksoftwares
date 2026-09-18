CACHE=/data/data/com.dhanuk.ovidai/files/sandbox/home/repo/dhanuksoftwares-main
WS=/data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272

echo "=== BEFORE (cache font state) ==="
for f in build.mjs index.html cookies.html docs/admin.html docs/nvidia-nim-speed-test.html favicon.svg; do
  printf "  %-38s Syne=%-3s DMSans=%-3s Inter=%s\n" "$f" "$(grep -c Syne "$CACHE/$f" 2>/dev/null)" "$(grep -c 'DM Sans' "$CACHE/$f" 2>/dev/null)" "$(grep -c Inter "$CACHE/$f" 2>/dev/null)"
done

echo ""
echo "=== SYNCING (workspace -> cache) ==="
for f in template.html lib/render.mjs build.mjs assets/style.css posts.json \
         index.html cookies.html privacy.html terms.html blog-template.html \
         lib/render-blog.mjs docs/admin.html docs/blog-admin.html \
         docs/nvidia-nim-speed-test.html favicon.svg; do
  if [ -f "$WS/$f" ]; then
    cp "$WS/$f" "$CACHE/$f"
    echo "  synced $f"
  else
    echo "  !! MISSING in workspace: $f"
  fi
done

echo ""
echo "=== AFTER (cache font state) ==="
for f in build.mjs index.html cookies.html docs/admin.html docs/nvidia-nim-speed-test.html favicon.svg; do
  printf "  %-38s Syne=%-3s DMSans=%-3s Inter=%s\n" "$f" "$(grep -c Syne "$CACHE/$f" 2>/dev/null)" "$(grep -c 'DM Sans' "$CACHE/$f" 2>/dev/null)" "$(grep -c Inter "$CACHE/$f" 2>/dev/null)"
done

echo ""
echo "=== cache relatedPosts markers ==="
grep -c relatedPosts "$CACHE/template.html" "$CACHE/build.mjs" "$CACHE/lib/render.mjs" 2>&1
echo "=== cache posts ==="
python3 -c "
import json; p=json.load(open('$CACHE/posts.json')); print(len(p),'posts:', [x['slug'] for x in p])
"
