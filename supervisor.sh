#!/bin/bash
# Robust supervisor using double-fork daemon technique
# This script monitors the Next.js dev server and restarts it if it dies.
# It itself runs as a double-forked daemon so it survives between bash sessions.

LOG=/home/z/my-project/dev.log
SUP_LOG=/home/z/my-project/supervisor.log
cd /home/z/my-project

echo "[$(date '+%H:%M:%S')] Supervisor daemon started" >> "$SUP_LOG"

while true; do
  # Check if server is alive
  CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  
  if [ "$CODE" != "200" ]; then
    echo "[$(date '+%H:%M:%S')] Server down (HTTP $CODE), starting..." >> "$SUP_LOG"
    
    # Kill any zombies
    pkill -9 -f "next-server" 2>/dev/null
    pkill -9 -f "next dev" 2>/dev/null
    pkill -9 -f "bun run dev" 2>/dev/null
    sleep 2
    
    # Double-fork start: (setsid bash -c 'cmd &' &)
    # This fully detaches the server so it survives between bash sessions
    (setsid bash -c 'cd /home/z/my-project && bun run dev >> /home/z/my-project/dev.log 2>&1 &' &)
    
    # Wait for ready
    for i in $(seq 1 30); do
      CODE=$(curl -s --max-time 2 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
      if [ "$CODE" = "200" ]; then
        echo "[$(date '+%H:%M:%S')] Server back up (HTTP $CODE)" >> "$SUP_LOG"
        break
      fi
      sleep 1
    done
  fi
  
  sleep 10
done
