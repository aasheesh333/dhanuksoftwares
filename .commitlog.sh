cd /data/data/com.dhanuk.ovidai/files/workspaces/ws_1789734427295272
for sha in 4b7ead34 9126b550 bb9bc60c; do
  curl -sS "https://api.github.com/repos/aasheesh333/dhanuksoftwares/commits/$sha" -o .cmp/c_$sha.json
  python3 -c "
import json
d=json.load(open('.cmp/c_$sha.json'))
print('=== '+\"$sha\"+'  parents='+str([p['sha'][:8] for p in d['parents']]))
for f in d.get('files',[]):
    print('   ',f['status'],f['filename'],'+%d/-%d'%(f['additions'],f['deletions']))
"
done
echo ""
echo "=== CURRENT REMOTE INTEGRITY ==="
curl -sS -H "Accept: application/vnd.github.raw" "https://api.github.com/repos/aasheesh333/dhanuksoftwares/contents/build.mjs?ref=main" -o .cmp/rb.mjs
echo "remote build.mjs  Syne:$(grep -c Syne .cmp/rb.mjs)  DM Sans:$(grep -c 'DM Sans' .cmp/rb.mjs)  Inter:$(grep -c Inter .cmp/rb.mjs)"
curl -sS -H "Accept: application/vnd.github.raw" "https://api.github.com/repos/aasheesh333/dhanuksoftwares/contents/index.html?ref=main" -o .cmp/ri.html
echo "remote index.html Syne:$(grep -c Syne .cmp/ri.html)  DM Sans:$(grep -c 'DM Sans' .cmp/ri.html)  Inter:$(grep -c Inter .cmp/ri.html)"
