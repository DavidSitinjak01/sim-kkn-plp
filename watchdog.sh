#!/bin/bash
# Watchdog to keep Next.js dev server alive
cd /home/z/my-project

while true; do
  # Check if server is responding
  CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  
  if [ "$CODE" != "200" ]; then
    echo "[$(date '+%H:%M:%S')] Server down (HTTP $CODE), restarting..." >> /home/z/my-project/watchdog.log
    
    # Kill any zombies
    pkill -9 -f "next-server" 2>/dev/null
    pkill -9 -f "bun run dev" 2>/dev/null
    sleep 2
    
    # Start fresh
    setsid nohup bun run dev > /home/z/my-project/dev.log 2>&1 < /dev/null &
    disown $! 2>/dev/null
    
    # Wait for it to be ready
    for i in $(seq 1 30); do
      CODE=$(curl -s --max-time 2 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
      if [ "$CODE" = "200" ]; then
        echo "[$(date '+%H:%M:%S')] Server back up (HTTP $CODE)" >> /home/z/my-project/watchdog.log
        break
      fi
      sleep 1
    done
  fi
  
  sleep 15
done
