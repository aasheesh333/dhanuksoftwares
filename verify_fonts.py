#!/usr/bin/env python3
import json, base64, urllib.request, ssl, time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

REPO = "aasheesh333/dhanuksoftwares"
FILES = [
    "index.html", "privacy.html", "terms.html", "cookies.html",
    "build.mjs", "template.html", "blog-template.html", "apps.json",
    "lib/render-blog.mjs", "lib/render.mjs", "lib/blog-schema.mjs",
    "assets/style.css", "docs/admin.html", "docs/blog-admin.html",
    "docs/nvidia-nim-speed-test.html", "favicon.svg", "posts.json",
]

def get(path):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}?ref=main"
    req = urllib.request.Request(url, headers={"User-Agent": "fontcheck", "Accept": "application/vnd.github+json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(4)
    raise RuntimeError("failed " + path)

print(f"{'file':42} {'sha':10} {'Syne':>5} {'DMSans':>7} {'Inter':>6}")
for f in FILES:
    try:
        j = get(f)
        if "content" not in j:
            print(f"{f:42} {'--':10} MISSING")
            continue
        d = base64.b64decode(j["content"]).decode("utf-8", "replace")
        print(f"{f:42} {j['sha'][:8]:10} {d.count('Syne'):5} {d.count('DM Sans'):7} {d.count('Inter'):6}")
    except Exception as e:
        print(f"{f:42} ERROR {e}")
