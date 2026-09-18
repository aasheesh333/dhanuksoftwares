cd /data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272
rm -rf .chk.sh .spill .bak .kd.json .live_posts.json .head_posts.json __pycache__
echo "=== remaining hidden ==="
ls -a1 | grep '^\.' || echo "(none)"
echo "=== top level ==="
ls -1
