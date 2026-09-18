CACHE=/data/data/com.dhanuk.ovidai/files/sandbox/home/repo/dhanuksoftwares-main
WS=/data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272
cd "$WS"
mkdir -p .cmp

fetch() { curl -sS -H "Accept: application/vnd.github.raw" "https://api.github.com/repos/aasheesh333/dhanuksoftwares/contents/$1?ref=main" -o ".cmp/remote_$(echo $1 | tr / _)"; }

for f in template.html lib/render.mjs build.mjs assets/style.css posts.json; do
  fetch "$f"
  R=".cmp/remote_$(echo $f | tr / _)"
  echo "########## $f ##########"
  printf "  workspace md5: %s  (%s bytes)\n" "$(md5sum "$WS/$f" | cut -c1-10)" "$(wc -c < "$WS/$f")"
  printf "  cache     md5: %s  (%s bytes)\n" "$(md5sum "$CACHE/$f" | cut -c1-10)" "$(wc -c < "$CACHE/$f")"
  printf "  remote    md5: %s  (%s bytes)\n" "$(md5sum "$R" | cut -c1-10)" "$(wc -c < "$R")"
done

echo ""
echo "########## MARKER PRESENCE ##########"
check() { # file marker
  printf "%-28s %-26s ws=%s cache=%s remote=%s\n" "$1" "$2" \
    "$(grep -c "$2" "$WS/$1" 2>/dev/null || echo 0)" \
    "$(grep -c "$2" "$CACHE/$1" 2>/dev/null || echo 0)" \
    "$(grep -c "$2" ".cmp/remote_$(echo $1 | tr / _)" 2>/dev/null || echo 0)"
}
check template.html "related-posts-section"
check lib/render.mjs "renderRelatedPostsHtml"
check build.mjs "relatedPosts"
check assets/style.css "related-post-card"
check posts.json "lofiga-slow-reverb-lofi-music-maker-app"
