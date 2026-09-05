#!/bin/bash
# Watchdog for Next.js dev server
# Only restart if HTTP check fails AND no next-server process running

LOG=/home/z/my-project/dev.log

start_server() {
  cd /home/z/my-project
  # Double-fork to fully detach
  ( setsid bash -c 'cd /home/z/my-project && exec bun run dev' > "$LOG" 2>&1 & ) 2>/dev/null
  sleep 6
}

while true; do
  # HTTP health check
  HTTP=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  
  if [ "$HTTP" = "200" ]; then
    # Server healthy — do nothing
    :
  else
    # Server not responding — check if process exists
    if pgrep -f "next-server" > /dev/null 2>&1; then
      # Process exists but not responding — give it time
      sleep 10
      HTTP2=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
      if [ "$HTTP2" != "200" ]; then
        echo "[$(date)] Server not responding (HTTP=$HTTP2), killing & restarting..." >> /tmp/watchdog.log
        pkill -9 -f "next" 2>/dev/null
        pkill -9 -f "bun run dev" 2>/dev/null
        sleep 3
        start_server
      fi
    else
      # No process — start fresh
      echo "[$(date)] No next-server process, starting..." >> /tmp/watchdog.log
      # Make sure port 3000 is free before starting
      pkill -9 -f "next" 2>/dev/null
      pkill -9 -f "bun run dev" 2>/dev/null
      sleep 2
      start_server
    fi
  fi
  
  sleep 20
done
