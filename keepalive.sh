#!/bin/bash
# Keep Next.js dev server alive — called by cron
cd /home/z/my-project
CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$CODE" != "200" ]; then
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "next dev" 2>/dev/null
  pkill -9 -f "bun run dev" 2>/dev/null
  sleep 2
  setsid bun run dev > /home/z/my-project/dev.log 2>&1 < /dev/null &
  echo "[$(date '+%H:%M:%S')] Restarted server" >> /home/z/my-project/keepalive.log
fi
