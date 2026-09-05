#!/bin/bash
# Auto-restart dev server jika mati.
cd /home/z/my-project

if ss -tlnp 2>/dev/null | grep -q ":3000"; then
  if curl -s --max-time 3 http://localhost:3000/api/pengaturan -o /dev/null 2>/dev/null; then
    exit 0
  fi
fi

pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 2

export NODE_OPTIONS="--max-old-space-size=1536"
nohup setsid bash -c '
  cd /home/z/my-project
  bun scripts/sync-prisma-provider.ts 2>>/tmp/dev.log
  exec ./node_modules/.bin/next dev -p 3000 --webpack
' >> /tmp/dev.log 2>&1 < /dev/null &
disown
echo "[$(date)] Server restarted" >> /tmp/watchdog.log
