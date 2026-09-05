#!/bin/bash
# Cek & restart dev server jika port 3000 mati
if ss -tlnp 2>/dev/null | grep -q ":3000"; then
  exit 0
fi
# Restart
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 2
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=1024"
setsid bash -c 'cd /home/z/my-project && exec ./node_modules/.bin/next dev -p 3000 --webpack > /tmp/dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
echo "[$(date)] Server restarted" >> /tmp/watchdog.log
