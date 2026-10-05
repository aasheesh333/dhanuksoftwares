#!/bin/bash
# Keep the 9router gateway up and its port public on every codespace start.
# Runs via devcontainer postStartCommand (backgrounded).

# Start 9router if not already running
if ! pgrep -f "9router --no-browser" >/dev/null 2>&1; then
  nohup 9router --no-browser --skip-update >/tmp/9router.log 2>&1 &
  echo "$(date -u +%FT%TZ) 9router started" >>/tmp/gateway.log
else
  echo "$(date -u +%FT%TZ) 9router already running" >>/tmp/gateway.log
fi

# Re-assert public port visibility (GitHub occasionally resets it to private).
# Retry for ~4 minutes to cover the port-forward registration race.
for i in $(seq 1 24); do
  sleep 10
  if gh codespace ports visibility 20128:public -c "$CODESPACE_NAME" >>/tmp/portvis.log 2>&1; then
    echo "$(date -u +%FT%TZ) port 20128 -> public (attempt $i)" >>/tmp/portvis.log
    break
  fi
  echo "$(date -u +%FT%TZ) visibility attempt $i failed, retrying" >>/tmp/portvis.log
done
