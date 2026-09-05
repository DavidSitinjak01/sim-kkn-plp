#!/bin/bash
# Persistent server starter with watchdog
cd /home/z/my-project

# Kill any existing
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "watchdog" 2>/dev/null
sleep 1

# Clear cache
rm -rf .next

# Start server in new session, fully detached
setsid bash -c 'exec bun run dev > /home/z/my-project/dev.log 2>&1' < /dev/null &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Start watchdog in new session
setsid bash -c '
while true; do
  sleep 20
  if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 5 2>/dev/null | grep -q "200"; then
    FAILS=$((FAILS+1))
    if [ $FAILS -ge 2 ]; then
      pkill -9 -f "next-server" 2>/dev/null
      pkill -9 -f "next dev" 2>/dev/null
      sleep 2
      cd /home/z/my-project
      setsid bash -c "exec bun run dev > /home/z/my-project/dev.log 2>&1" < /dev/null &
      FAILS=0
    fi
  else
    FAILS=0
  fi
done
' < /dev/null &
WATCHDOG_PID=$!
echo "Watchdog PID: $WATCHDOG_PID"

# Wait for server to be ready
echo "Waiting for server..."
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 5 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "Server ready! HTTP $CODE"
    exit 0
  fi
  sleep 2
done
echo "Server failed to start in 60s"
exit 1
