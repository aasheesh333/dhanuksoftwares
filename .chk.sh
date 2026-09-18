cd /data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272
echo "=== git status ==="
git status --short | head -20
echo "=== branch ==="
git branch --show-current
echo "=== remote HEAD posts.json ==="
git show HEAD:posts.json > .head_posts.json
python3 -c "
import json
p=json.load(open('.head_posts.json'))
print(len(p),'posts')
for x in p: print(' -',x['slug'])
"
