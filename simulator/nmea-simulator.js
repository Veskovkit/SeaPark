#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const {
  loadRoute,
  createTrackFollower,
  createLegacyFollower,
} = require('./lib/track-route');

// Synced from dashboard/src/lib/zones.js — run: node scripts/sync-simulator-zones.mjs
const ZONE_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'zone-data.json'), 'utf8'),
);
const ZONE_FEATURES = ZONE_DATA.features;

const TYPE_PRIORITY = { danger: 0, restricted: 1, safe: 2 };

function parseArgs(argv) {
  const opts = {
    route: path.join(__dirname, 'routes', 'piran-demo-track.json'),
    speed: 10,
    port: 10110,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--route' && argv[i + 1]) {
      opts.route = path.isAbsolute(argv[++i])
        ? argv[i]
        : path.resolve(process.cwd(), argv[i]);
    } else if (arg === '--speed' && argv[i + 1]) {
      opts.speed = Math.max(0.25, parseFloat(argv[++i]));
    } else if (arg === '--port' && argv[i + 1]) {
      opts.port = parseInt(argv[++i], 10);
    }
  }

  return opts;
}

function nmeaChecksum(body) {
  let check = 0;
  for (let i = 1; i < body.length; i++) {
    if (body[i] === '*') break;
    check ^= body.charCodeAt(i);
  }
  return check.toString(16).toUpperCase().padStart(2, '0');
}

function withChecksum(sentenceWithoutStar) {
  const body = sentenceWithoutStar.startsWith('$')
    ? sentenceWithoutStar
    : `$${sentenceWithoutStar}`;
  return `${body}*${nmeaChecksum(body)}`;
}

function decimalToNmea(decimal, isLat) {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minutes = (abs - deg) * 60;
  const degPad = isLat ? 2 : 3;
  const value =
    String(deg).padStart(degPad, '0') + minutes.toFixed(4).padStart(7, '0');
  const dir = isLat
    ? decimal >= 0
      ? 'N'
      : 'S'
    : decimal >= 0
      ? 'E'
      : 'W';
  return { value, dir };
}

function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLng = toRad(lng2 - lng1);
  const y = Math.sin(deltaLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function formatDisplayCoord(lat, lng) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `[${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}]`;
}

function getPolygonRing(feature) {
  let ring = feature.geometry.coordinates[0];
  while (ring.length === 1 && Array.isArray(ring[0]?.[0])) {
    ring = ring[0];
  }
  return ring;
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getZoneAt(lat, lng) {
  const matches = ZONE_FEATURES.filter((feature) =>
    pointInRing(lng, lat, getPolygonRing(feature)),
  );
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) =>
      TYPE_PRIORITY[a.properties.type] - TYPE_PRIORITY[b.properties.type],
  );
  const hit = matches[0];
  return {
    id: hit.properties.id,
    name: hit.properties.name,
    type: hit.properties.type,
  };
}

function buildGPRMC(now, lat, lng, sog, cog) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}.00`;
  const date = `${pad(now.getUTCDate())}${pad(now.getUTCMonth() + 1)}${String(now.getUTCFullYear()).slice(-2)}`;
  const latNmea = decimalToNmea(lat, true);
  const lngNmea = decimalToNmea(lng, false);
  const body = `$GPRMC,${time},A,${latNmea.value},${latNmea.dir},${lngNmea.value},${lngNmea.dir},${sog.toFixed(1)},${cog.toFixed(0)},${date},,,A`;
  return withChecksum(body);
}

function buildGPGGA(now, lat, lng) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}.00`;
  const latNmea = decimalToNmea(lat, true);
  const lngNmea = decimalToNmea(lng, false);
  const body = `$GPGGA,${time},${latNmea.value},${latNmea.dir},${lngNmea.value},${lngNmea.dir},1,08,0.9,0.0,M,0.0,M,,`;
  return withChecksum(body);
}

function verifyChecksum(sentence) {
  const star = sentence.indexOf('*');
  if (star === -1) return false;
  const body = sentence.slice(0, star);
  const expected = sentence.slice(star + 1).trim();
  return nmeaChecksum(body) === expected.toUpperCase();
}

function logZoneTransition(prevZone, nextZone) {
  if (!nextZone) return;

  if (nextZone.type === 'danger') {
    console.log(`\uD83D\uDEA8 ENTERING DANGER ZONE: ${nextZone.name}`);
  } else if (nextZone.type === 'restricted') {
    console.log(`\u26A0\uFE0F  Entering restricted zone: ${nextZone.name}`);
  } else if (nextZone.type === 'safe' && (!prevZone || prevZone.type !== 'safe')) {
    console.log(`\u2705 Entering safe zone: ${nextZone.name}`);
  }
}

function runSimulator(opts, route) {
  const clients = new Set();
  const server = net.createServer((socket) => {
    clients.add(socket);
    console.log(`   Client connected (${clients.size} total)`);
    socket.on('close', () => {
      clients.delete(socket);
      console.log(`   Client disconnected (${clients.size} remaining)`);
    });
    socket.on('error', () => clients.delete(socket));
  });

  const routeLabel = path.basename(opts.route, '.json');
  const pointCount =
    route.mode === 'track' ? route.points.length : route.waypoints.length;

  console.log('\uD83D\uDEF5\uFE0F  SeaPark NMEA Simulator');
  console.log(`   Route: ${route.label} (${pointCount} points) \u2014 ${routeLabel}`);
  if (route.mode === 'track') {
    console.log(`   Mode: dense zone track @ ${route.sogKnots} kn`);
    if (route.dwells?.length) {
      console.log(`   Dwell stops: ${route.dwells.map((d) => d.name).join(', ')}`);
    }
    if (route.turnaround) {
      console.log(
        `   Turnaround: ${route.turnaround.lat.toFixed(5)}°N ${route.turnaround.lng.toFixed(5)}°E → south → U-turn → reverse → stop`,
      );
    }
  }
  console.log(`   Speed: ${opts.speed}x`);
  console.log(`   TCP: listening on port ${opts.port}`);
  console.log('   Waiting for Signal K to connect...');
  console.log('');

  server.listen(opts.port);

  const follower =
    route.mode === 'track'
      ? createTrackFollower(route, {
          onDwell: (d) =>
            console.log(`\u2693 Dwelling at ${d.name} (${d.seconds}s)`),
          onTurn: (dir) => {
            const msgs = {
              south: '\u2B07 South leg before U-turn',
              uturn: '\u21BA U-turn offshore (west)',
              reverse: '\u21A9 Reversing along outbound track',
              stopped: '\u2693 Back at marina — stopped',
              forward: '\u21AA Forward along track',
            };
            console.log(msgs[dir] ?? dir);
          },
        })
      : createLegacyFollower(route.waypoints);

  let prevZone = null;
  const tickMs = 1000 / opts.speed;

  function broadcast(line) {
    const payload = `${line}\r\n`;
    for (const client of clients) {
      if (!client.destroyed) client.write(payload);
    }
  }

  function tick() {
    const { lat, lng, sog, cog } = follower.step(tickMs, opts.speed);
    const now = new Date();
    broadcast(buildGPRMC(now, lat, lng, sog, cog));
    broadcast(buildGPGGA(now, lat, lng));

    const zone = getZoneAt(lat, lng);
    const prevId = prevZone?.id ?? null;
    const nextId = zone?.id ?? null;
    if (prevId !== nextId) {
      if (!zone && prevZone) {
        console.log('\u2705 Returned to safe water');
      } else if (zone) {
        logZoneTransition(prevZone, zone);
      }
      prevZone = zone;
    }
  }

  const start =
    route.mode === 'track' ? route.points[0] : route.waypoints[0];
  console.log(`\u2693 Start: ${formatDisplayCoord(start.lat, start.lng)}`);

  const initialZone = getZoneAt(start.lat, start.lng);
  if (initialZone) logZoneTransition(null, initialZone);
  prevZone = initialZone;

  tick();
  setInterval(tick, tickMs);
}

function main() {
  const opts = parseArgs(process.argv);
  const route = loadRoute(opts.route);
  runSimulator(opts, route);
}

if (require.main === module) {
  main();
}

module.exports = {
  nmeaChecksum,
  decimalToNmea,
  buildGPRMC,
  buildGPGGA,
  verifyChecksum,
  getZoneAt,
  bearingDeg,
};
