#!/bin/bash
# Start server + supervisor as a fully detached daemon pair
cd /home/z/my-project
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "bun run dev" 2>/dev/null
sleep 1
setsid bash -c '
cd /home/z/my-project
# Start dev server
bun run dev > /home/z/my-project/dev.log 2>&1 &
SRV=$!
# Supervisor loop
while true; do
  if ! kill -0 $SRV 2>/dev/null; then
    bun run dev >> /home/z/my-project/dev.log 2>&1 &
    SRV=$!
  fi
  CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$CODE" != "200" ]; then
    sleep 2
    CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
    if [ "$CODE" != "200" ]; then
      kill $SRV 2>/dev/null
      sleep 1
      bun run dev >> /home/z/my-project/dev.log 2>&1 &
      SRV=$!
    fi
  fi
  sleep 5
done
' < /dev/null > /dev/null 2>&1 &
echo $!
