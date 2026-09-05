#!/usr/bin/env bash
# Robust dev server starter — survives between shell sessions via detached spawn
# Usage: node start-dev.sh  (or: bun run start-dev)
pkill -f "next dev" 2>/dev/null
sleep 1
rm -rf .next
node -e '
const { spawn } = require("child_process");
const fs = require("fs");
const fd = fs.openSync("dev.log", "w");
const child = spawn("bun", ["run", "dev"], {
  cwd: process.cwd(),
  detached: true,
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
  stdio: ["ignore", fd, fd],
});
child.unref();
console.log("dev server spawned, pid:", child.pid);
'
