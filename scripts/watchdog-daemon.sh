#!/bin/bash
# Watchdog daemon — auto-restart Next.js dev server jika port 3000 mati.
# Pakai setsid double-fork untuk detach dari session bash.
cd /home/z/my-project
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ":3000"; then
    pkill -9 -f "next dev" 2>/dev/null
    pkill -9 -f "next-server" 2>/dev/null
    sleep 3
    echo "[$(date)] Server restarted by watchdog" >> /tmp/watchdog.log
    setsid bash -c '
      cd /home/z/my-project
      NODE_OPTIONS="--max-old-space-size=1024" exec ./node_modules/.bin/next dev -p 3000 --webpack > /tmp/dev.log 2>&1
    ' < /dev/null > /dev/null 2>&1 &
    sleep 30  # wait for compile
  fi
  sleep 20
done
