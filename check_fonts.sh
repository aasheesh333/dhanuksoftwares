#!/bin/bash
cd /data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272
OUT=$PWD/.fontcheck.html
for f in docs/admin.html docs/blog-admin.html docs/nvidia-nim-speed-test.html favicon.svg; do
  curl -sS -m 30 "https://raw.githubusercontent.com/aasheesh333/dhanuksoftwares/main/$f?cb=$RANDOM" -o "$OUT"
  python3 -c "
d=open('$OUT',encoding='utf-8',errors='replace').read()
print(f\"$f  bytes={len(d)}  Syne={d.count('Syne')}  DMSans={d.count('DM Sans')}  Inter={d.count('Inter')}\")
"
done
