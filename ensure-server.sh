#!/bin/bash
cd /home/z/my-project

# Check if server is already running
CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$CODE" = "200" ]; then
  echo "Server already running (HTTP 200)"
  exit 0
fi

# Kill zombies
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "bun run dev" 2>/dev/null
sleep 2

# Clear cache if corrupted
if [ -d .next ] && [ ! -f .next/build-manifest.json ]; then
  rm -rf .next
fi

# Start server with setsid (new session, detached)
> /home/z/my-project/dev.log
setsid bun run dev > /home/z/my-project/dev.log 2>&1 < /dev/null &
disown 2>/dev/null

# Wait for server to be FULLY ready (compile complete, serving content)
for i in $(seq 1 90); do
  CODE=$(curl -s --max-time 2 -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    # Verify content is actually being served (not just port open)
    SIZE=$(curl -s --max-time 5 http://localhost:3000 2>/dev/null | wc -c)
    if [ "$SIZE" -gt 1000 ]; then
      echo "✓ Server ready after ${i}s (HTTP $CODE, ${SIZE} bytes)"
      exit 0
    fi
  fi
  sleep 1
done

echo "✗ Server failed to start"
exit 1
