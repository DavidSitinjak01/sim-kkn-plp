#!/bin/bash
# Persistent daemon - restarts server when it dies
cd /home/z/my-project
while true; do
  CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$CODE" != "200" ]; then
    pkill -9 -f "next-server" 2>/dev/null
    pkill -9 -f "bun run dev" 2>/dev/null
    sleep 2
    > /home/z/my-project/dev.log
    setsid bun run dev > /home/z/my-project/dev.log 2>&1 < /dev/null &
    echo "[$(date '+%H:%M:%S')] Restarted" >> /home/z/my-project/daemon.log
    # Wait for it to be ready
    for j in $(seq 1 60); do
      CODE=$(curl -s --max-time 2 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
      if [ "$CODE" = "200" ]; then break; fi
      sleep 1
    done
  fi
  sleep 5
done
