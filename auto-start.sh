#!/bin/bash
# Auto-start script - ensures server is running
cd /home/z/my-project

# Check if server is responding
CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)

if [ "$CODE" != "200" ]; then
  # Kill any zombies
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "next dev" 2>/dev/null
  pkill -9 -f "bun run dev" 2>/dev/null
  sleep 1
  
  # Start server fresh
  > /home/z/my-project/dev.log
  setsid bun run dev > /home/z/my-project/dev.log 2>&1 < /dev/null &
  
  # Log restart
  echo "[$(date '+%H:%M:%S')] Server restarted" >> /home/z/my-project/auto-start.log
fi
