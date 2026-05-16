#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');

// Bounding boxes mirror dashboard/src/lib/zones.js polygon extents (lng/lat min-max).
const ZONES = [
  { id: 'piran-oasis', name: 'Morska oaza Piran', type: 'danger', minLng: 13.578, minLat: 45.484, maxLng: 13.589, maxLat: 45.492 },
  { id: 'cladocora', name: 'Cladocora structure', type: 'danger', minLng: 13.581, minLat: 45.486, maxLng: 13.589, maxLat: 45.492 },
  { id: 'posidonia-beds', name: 'Posidonia meadows', type: 'danger', minLng: 13.548, minLat: 45.492, maxLng: 13.578, maxLat: 45.512 },
  { id: 'strunjan-reserve', name: 'Krajinski park Strunjan', type: 'restricted', minLng: 13.59, minLat: 45.512, maxLng: 13.626, maxLat: 45.542 },
  { id: 'debeli-rtic', name: 'Debeli rtic', type: 'restricted', minLng: 13.632, minLat: 45.576, maxLng: 13.656, maxLat: 45.596 },
  { id: 'croatia-mpa-gulf', name: 'Croatian MPA Gulf', type: 'restricted', minLng: 13.488, minLat: 45.458, maxLng: 13.538, maxLat: 45.488 },
  { id: 'koper-marina', name: 'Koper Marina', type: 'safe', minLng: 13.724, minLat: 45.546, maxLng: 13.738, maxLat: 45.554 },
  { id: 'piran-marina', name: 'Piran Marina', type: 'safe', minLng: 13.564, minLat: 45.526, maxLng: 13.574, maxLat: 45.532 },
];

const TYPE_PRIORITY = { danger: 0, restricted: 1, safe: 2 };

function parseArgs(argv) {
  const opts = {
    route: path.join(__dirname, 'routes', 'piran-demo.json'),
    speed: 1,
    port: 10110,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--route' && argv[i + 1]) {
      opts.route = path.isAbsolute(argv[++i])
        ? argv[i]
        : path.resolve(process.cwd(), argv[i]);
    } else if (arg === '--speed' && argv[i + 1]) {
      opts.speed = Math.max(0.1, parseFloat(argv[++i]));
    } else if (arg === '--port' && argv[i + 1]) {
      opts.port = parseInt(argv[++i], 10);
    }
  }

  return opts;
}

function loadWaypoints(routePath) {
  const raw = fs.readFileSync(routePath, 'utf8');
  const waypoints = JSON.parse(raw);
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new Error('Route must be a JSON array with at least 2 waypoints');
  }
  return waypoints;
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

function haversineNm(lat1, lng1, lat2, lng2) {
  const R = 3440.065;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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

function inBBox(lat, lng, zone) {
  return (
    lat >= zone.minLat &&
    lat <= zone.maxLat &&
    lng >= zone.minLng &&
    lng <= zone.maxLng
  );
}

function getZoneAt(lat, lng) {
  const matches = ZONES.filter((z) => inBBox(lat, lng, z));
  if (matches.length === 0) return null;
  matches.sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]);
  return matches[0];
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

function runSimulator(opts, waypoints) {
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
  console.log('\uD83D\uDEF5\uFE0F  SeaPark NMEA Simulator');
  console.log(
    `   Route: Gulf of Piran demo (${waypoints.length} waypoints) \u2014 ${routeLabel}`,
  );
  console.log(`   Speed: ${opts.speed}x`);
  console.log(`   TCP: listening on port ${opts.port}`);
  console.log('   Waiting for Signal K to connect...');
  console.log('');

  server.listen(opts.port);

  let segmentIndex = 0;
  let segmentElapsedMs = 0;
  let prevZone = null;
  let lastWaypointLogged = -1;

  const tickMs = 1000 / opts.speed;

  function broadcast(line) {
    const payload = `${line}\r\n`;
    for (const client of clients) {
      if (!client.destroyed) client.write(payload);
    }
  }

  function advanceRoute() {
    const from = waypoints[segmentIndex];
    const to = waypoints[(segmentIndex + 1) % waypoints.length];
    const durationMs = from.durationSeconds * 1000;
    const t = Math.min(segmentElapsedMs / durationMs, 1);

    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;

    const distNm = haversineNm(from.lat, from.lng, to.lat, to.lng);
    const sog =
      from.durationSeconds > 0
        ? distNm / (from.durationSeconds / 3600)
        : 0;
    const cog = bearingDeg(lat, lng, to.lat, to.lng);

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

    if (t >= 1) {
      segmentIndex = (segmentIndex + 1) % waypoints.length;
      segmentElapsedMs = 0;

      const wpIdx = segmentIndex;
      if (wpIdx !== lastWaypointLogged) {
        lastWaypointLogged = wpIdx;
        const wp = waypoints[wpIdx];
        console.log(
          `\u2693 Waypoint ${wpIdx + 1}/${waypoints.length}: "${wp.name}" ${formatDisplayCoord(wp.lat, wp.lng)}`,
        );
        if (wp.note) console.log(`   ${wp.note}`);
      }
    } else {
      segmentElapsedMs += tickMs;
    }
  }

  console.log(
    `\u2693 Waypoint 1/${waypoints.length}: "${waypoints[0].name}" ${formatDisplayCoord(waypoints[0].lat, waypoints[0].lng)}`,
  );
  if (waypoints[0].note) console.log(`   ${waypoints[0].note}`);
  lastWaypointLogged = 0;

  const initialZone = getZoneAt(waypoints[0].lat, waypoints[0].lng);
  if (initialZone) logZoneTransition(null, initialZone);
  prevZone = initialZone;

  advanceRoute();
  setInterval(advanceRoute, tickMs);
}

function main() {
  const opts = parseArgs(process.argv);
  const waypoints = loadWaypoints(opts.route);
  runSimulator(opts, waypoints);
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
  haversineNm,
  bearingDeg,
};
