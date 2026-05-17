/**
 * Builds routes/piran-demo-track.json — dense polyline through zone centroids
 * and known fairway points. Run: node scripts/build-demo-track.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const zoneData = JSON.parse(
  fs.readFileSync(path.join(root, 'zone-data.json'), 'utf8'),
);

function ring(feature) {
  let r = feature.geometry.coordinates[0];
  while (r.length === 1 && Array.isArray(r[0]?.[0])) r = r[0];
  return r;
}

function centroid(feature) {
  const coords = ring(feature);
  const n = coords.length - 1;
  let lng = 0;
  let lat = 0;
  for (let i = 0; i < n; i += 1) {
    lng += coords[i][0];
    lat += coords[i][1];
  }
  return { lat: lat / n, lng: lng / n, id: feature.properties.id };
}

function zonePoint(id) {
  const f = zoneData.features.find((x) => x.properties.id === id);
  if (!f) throw new Error(`Zone not found: ${id}`);
  return centroid(f);
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
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

/** Insert points every ~stepM meters along anchor chain. */
function resampleAnchors(anchors, stepM = 100) {
  const out = [];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const dist = haversineM(a.lat, a.lng, b.lat, b.lng);
    const steps = Math.max(1, Math.ceil(dist / stepM));
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      out.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      });
    }
  }
  const last = anchors[anchors.length - 1];
  out.push({ lat: last.lat, lng: last.lng });
  return out;
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function getZoneAt(lat, lng) {
  for (const f of zoneData.features) {
    if (pointInRing(lng, lat, ring(f))) return f.properties.id;
  }
  return null;
}

// Marina → Izola: smooth SW curve (slight north bias near Izola, no sharp L-turns)
const anchors = [
  zonePoint('koper-marina'),
  { lat: 45.5506, lng: 13.718, id: 'bay-1' },
  { lat: 45.5498, lng: 13.708, id: 'bay-2' },
  { lat: 45.5493, lng: 13.698, id: 'bay-3' },
  { lat: 45.5488, lng: 13.691, id: 'bay-4' },
  { lat: 45.5480, lng: 13.684, id: 'bay-5' },
  { lat: 45.5475, lng: 13.677, id: 'izola-1' },
  { lat: 45.5470, lng: 13.671, id: 'izola-2' },
  { lat: 45.5462, lng: 13.665, id: 'izola-3' },
  { lat: 45.5445, lng: 13.652, id: 'coast-1' },
  { lat: 45.5425, lng: 13.642, id: 'coast-2' },
  { lat: 45.5410, lng: 13.635, id: 'coast-3' },
  { lat: 45.5395, lng: 13.629, id: 'coast-4' },
  { lat: 45.5385, lng: 13.627, id: 'cap-aisvn43' },
  { lat: 45.5383, lng: 13.6265, id: 'cap-pass' },
  { lat: 45.5382, lng: 13.6252, id: 'cap-west' },
  { lat: 45.5395, lng: 13.6250, id: 'north-1' },
  { lat: 45.5410, lng: 13.6235, id: 'north-2' },
  { lat: 45.5418, lng: 13.6200, id: 'north-3' },
  { lat: 45.5405, lng: 13.6195, id: 'north-4' },
  { lat: 45.5405, lng: 13.6175, id: 'west-high-1' },
  { lat: 45.5405, lng: 13.6155, id: 'west-high-2' },
  { lat: 45.5405, lng: 13.6135, id: 'west-high-3' },
  { lat: 45.5405, lng: 13.6115, id: 'west-high-4' },
  { lat: 45.5395, lng: 13.6105, id: 'west-mid' },
  { lat: 45.5390, lng: 13.61017, id: 'west-hazard' },
  { lat: 45.5390, lng: 13.6070, id: 'west-hold-1' },
  { lat: 45.5390, lng: 13.6040, id: 'west-hold-2' },
  { lat: 45.5390, lng: 13.6010, id: 'west-hold-3' },
  { lat: 45.5390, lng: 13.59983, id: 'turnaround-end' },
];

const turnaround = {
  lat: 45 + 32.34 / 60,
  lng: 13 + 35.99 / 60,
  radiusM: 90,
  southM: 260,
  turnRateDegPerSec: 4.5,
  turnSpeedRatio: 0.42,
  uturnDegrees: 275,
};

const coordinates = resampleAnchors(anchors, 65);

// Validate zone coverage
const zoneHits = new Set();
for (const c of coordinates) {
  const z = getZoneAt(c.lat, c.lng);
  if (z) zoneHits.add(z);
}

const track = {
  name: 'Gulf of Piran demo track',
  description:
    'Dense fairway through Navigator restricted areas and YouSea danger zones. Regenerate with node scripts/build-demo-track.mjs',
  sogKnots: 25,
  stepMeters: 65,
  dwells: [
    {
      lat: zonePoint('piran-oasis').lat,
      lng: zonePoint('piran-oasis').lng,
      radiusM: 120,
      seconds: 55,
      name: 'Morska oaza Piran',
    },
    {
      lat: zonePoint('aisvn17').lat,
      lng: zonePoint('aisvn17').lng,
      radiusM: 100,
      seconds: 25,
      name: 'Strunjan restricted',
    },
  ],
  coordinates,
  turnaround,
  zoneIdsOnTrack: [...zoneHits].sort(),
};

const outPath = path.join(root, 'routes', 'piran-demo-track.json');
fs.writeFileSync(outPath, `${JSON.stringify(track, null, 2)}\n`, 'utf8');
console.log(`Wrote ${coordinates.length} points -> ${outPath}`);
console.log('Zones touched:', track.zoneIdsOnTrack.join(', '));
