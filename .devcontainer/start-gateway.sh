#!/bin/bash
# Keep the 9router gateway up, its port public, and the zrok tunnel alive.
# Runs via devcontainer postStartCommand (backgrounded).

# 1. Start 9router if not already running
if ! pgrep -f "9router --no-browser" >/dev/null 2>&1; then
  nohup 9router --no-browser --skip-update >/tmp/9router.log 2>&1 &
  echo "$(date -u +%FT%TZ) 9router started" >>/tmp/gateway.log
fi

# 2. Re-assert public port visibility (GitHub occasionally resets it to private)
(for i in $(seq 1 24); do
  sleep 10
  if gh codespace ports visibility 20128:public -c "$CODESPACE_NAME" >>/tmp/portvis.log 2>&1; then
    echo "$(date -u +%FT%TZ) port 20128 -> public (attempt $i)" >>/tmp/portvis.log
    break
  fi
done) &

# 3. zrok tunnel (needs ZROK_ENABLE_TOKEN codespace secret)
if [ -n "$ZROK_ENABLE_TOKEN" ]; then
  export PATH="$HOME/.local/bin:$PATH"
  if ! command -v zrok >/dev/null 2>&1; then
    mkdir -p ~/.local/bin /tmp/zrok-dl
    if curl -sL --max-time 180 -o /tmp/zrok-dl/zrok.tgz https://github.com/openziti/zrok/releases/download/v2.0.7/zrok_2.0.7_linux_amd64.tar.gz; then
      tar xzf /tmp/zrok-dl/zrok.tgz -C /tmp/zrok-dl zrok2 && mv /tmp/zrok-dl/zrok2 ~/.local/bin/zrok && chmod +x ~/.local/bin/zrok
      echo "$(date -u +%FT%TZ) zrok installed" >>/tmp/zrok.log
    else
      echo "$(date -u +%FT%TZ) zrok download failed" >>/tmp/zrok.log
    fi
  fi
  if command -v zrok >/dev/null 2>&1; then
    # enable (skip if already enabled)
    if [ ! -d ~/.zrok2 ] && [ ! -d ~/.zrok ]; then
      zrok enable "$ZROK_ENABLE_TOKEN" --headless >>/tmp/zrok.log 2>&1 || \
        echo "$(date -u +%FT%TZ) zrok enable failed (may already be enabled)" >>/tmp/zrok.log
    fi
    # reserve name (idempotent)
    zrok create name aasheesh-9router --headless >>/tmp/zrok.log 2>&1 || true
    # keep the public share alive; URL: https://aasheesh-9router.shares.zrok.io
    (while true; do
      echo "$(date -u +%FT%TZ) starting zrok share" >>/tmp/zrok-share.log
      zrok share public http://127.0.0.1:20128 -n public:aasheesh-9router --headless >>/tmp/zrok-share.log 2>&1
      echo "$(date -u +%FT%TZ) share exited, retrying in 10s" >>/tmp/zrok-share.log
      sleep 10
    done) &
    echo "$(date -u +%FT%TZ) zrok share loop launched" >>/tmp/zrok.log
  fi
else
  echo "$(date -u +%FT%TZ) ZROK_ENABLE_TOKEN not set, skipping zrok" >>/tmp/zrok.log
fi
