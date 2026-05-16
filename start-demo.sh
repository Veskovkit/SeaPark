#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "🛥️  Starting SeaPark Demo..."
echo ""

echo "Starting NMEA simulator (2x speed)..."
(cd simulator && npm run demo) &
SIMULATOR_PID=$!

sleep 2

echo "Starting Signal K server..."
(cd server && signalk-server -c .) &
SIGNALK_PID=$!

sleep 3

echo "Starting helm dashboard..."
(cd dashboard && npm run dev) &
DASHBOARD_PID=$!

echo ""
echo "✅ SeaPark Demo Running"
echo "   Helm dashboard: http://localhost:5173"
echo "   Signal K admin: http://localhost:3000"
echo "   Press Ctrl+C to stop all"
echo ""

cleanup() {
  kill "$SIMULATOR_PID" "$SIGNALK_PID" "$DASHBOARD_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
