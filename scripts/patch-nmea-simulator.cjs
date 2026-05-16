const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'simulator', 'nmea-simulator.js');
let s = fs.readFileSync(p, 'utf8');

const zonesBlock = `// Synced from dashboard/src/lib/zones.js — run: node scripts/sync-simulator-zones.mjs
const ZONE_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'zone-data.json'), 'utf8'),
);
const ZONE_FEATURES = ZONE_DATA.features;`;

const hitBlock = `function getPolygonRing(feature) {
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
}`;

const zStart = s.indexOf('// Bounding boxes mirror');
const zEnd = s.indexOf('];', zStart) + 2;
if (zStart < 0) throw new Error('ZONES block not found');
s = s.slice(0, zStart) + zonesBlock + s.slice(zEnd);

const hStart = s.indexOf('function inBBox');
const hEnd = s.indexOf('function buildGPRMC', hStart);
if (hStart < 0 || hEnd < 0) throw new Error('hit block not found');
s = s.slice(0, hStart) + hitBlock + '\n\n' + s.slice(hEnd);

fs.writeFileSync(p, s, 'utf8');
console.log('Patched', p);
