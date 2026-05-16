import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const simPath = path.join(root, 'nmea-simulator.js');
const routePath = path.join(root, 'routes', 'piran-demo.json');

let code = execSync('git show HEAD:simulator/nmea-simulator.js').toString('utf8');

if (!code.includes('segmentDirection')) {
  code = code.replace(
    '  let segmentIndex = 0;\n  let segmentElapsedMs = 0;',
    '  let segmentIndex = 0;\n  let segmentDirection = 1;\n  let segmentElapsedMs = 0;',
  );
  code = code.replace(
    `    const from = waypoints[segmentIndex];
    const to = waypoints[(segmentIndex + 1) % waypoints.length];`,
    `    const toIndex = segmentIndex + segmentDirection;
    const from = waypoints[segmentIndex];
    const to = waypoints[toIndex];`,
  );
  code = code.replace(
    `    if (t >= 1) {
      segmentIndex = (segmentIndex + 1) % waypoints.length;
      segmentElapsedMs = 0;

      const wpIdx = segmentIndex;`,
    `    if (t >= 1) {
      segmentIndex = toIndex;
      segmentElapsedMs = 0;

      if (segmentDirection === 1 && segmentIndex >= waypoints.length - 1) {
        segmentDirection = -1;
      } else if (segmentDirection === -1 && segmentIndex <= 0) {
        segmentDirection = 1;
      }

      const wpIdx = segmentIndex;`,
  );
}

const densifyBlock = `function haversineKm(lat1, lng1, lat2, lng2) {
  return haversineNm(lat1, lng1, lat2, lng2) * 1.852;
}

/** Split long legs so linear interpolation stays in the coastal channel (~450 m steps). */
function densifyRoute(waypoints, maxLegKm = 0.45) {
  const out = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const legKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const steps = Math.max(1, Math.ceil(legKm / maxLegKm));
    for (let k = 0; k < steps; k += 1) {
      const t = (k + 1) / steps;
      const isFirst = i === 0 && k === 0;
      const isLast = k === steps - 1;
      out.push({
        name: isFirst ? a.name : isLast ? b.name : \`\${a.name} -> \${b.name}\`,
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        durationSeconds: Math.max(2, Math.round(a.durationSeconds / steps)),
        ...(isFirst && a.note ? { note: a.note } : {}),
        ...(isLast && b.note ? { note: b.note } : {}),
      });
    }
  }
  return out;
}

`;

if (!code.includes('function densifyRoute')) {
  code = code.replace(
    'function formatDisplayCoord(lat, lng) {',
    `${densifyBlock}function formatDisplayCoord(lat, lng) {`,
  );
  code = code.replace(
    '  return waypoints;\n}',
    '  return densifyRoute(waypoints);\n}',
  );
}

const route = [
  {
    name: 'Marina Koper departure',
    lat: 45.55022,
    lng: 13.72782,
    durationSeconds: 20,
    note: 'Safe zone - Koper marina basin',
  },
  {
    name: 'Basin west',
    lat: 45.5495,
    lng: 13.712,
    durationSeconds: 18,
    note: 'West across Koprski Bay (stay in water)',
  },
  {
    name: 'Bay mid-west',
    lat: 45.548,
    lng: 13.692,
    durationSeconds: 20,
    note: 'West before turning south — avoids Ankaran land',
  },
  {
    name: 'Bay channel SW',
    lat: 45.544,
    lng: 13.672,
    durationSeconds: 20,
    note: 'Along west side of bay',
  },
  {
    name: 'Petelinji offshore',
    lat: 45.539,
    lng: 13.656,
    durationSeconds: 20,
    note: 'Bay mouth at Petelinji (45°32′N 13°39′E)',
  },
  {
    name: 'Adriatic off cape',
    lat: 45.534,
    lng: 13.642,
    durationSeconds: 20,
    note: 'Clear of Debeli rtic (45°35′N 13°42′E)',
  },
  {
    name: 'Off Ankaran shore',
    lat: 45.528,
    lng: 13.635,
    durationSeconds: 22,
    note: 'Coastal fairway',
  },
  {
    name: 'Izola offshore',
    lat: 45.524,
    lng: 13.62,
    durationSeconds: 22,
    note: 'West of Izola harbour',
  },
  {
    name: 'Off Izola S',
    lat: 45.519,
    lng: 13.594,
    durationSeconds: 18,
    note: 'South of Izola — turning offshore',
  },
  {
    name: 'Off Simonov zaliv W',
    lat: 45.5155,
    lng: 13.581,
    durationSeconds: 18,
    note: 'West of Simon Bay',
  },
  {
    name: 'Strunjan cliffs W',
    lat: 45.5115,
    lng: 13.571,
    durationSeconds: 20,
    note: 'West of Strunjan cliff coast',
  },
  {
    name: 'Strunjan S offshore',
    lat: 45.5075,
    lng: 13.563,
    durationSeconds: 18,
    note: 'South of Strunjan — Adriatic fairway',
  },
  {
    name: 'Off Fiesa W',
    lat: 45.5035,
    lng: 13.556,
    durationSeconds: 18,
    note: 'West of Fiesa — clear of Piran peninsula',
  },
  {
    name: 'Piran Bay mouth W',
    lat: 45.4995,
    lng: 13.557,
    durationSeconds: 18,
    note: 'Bay entrance from the west',
  },
  {
    name: 'Piran Bay mid W',
    lat: 45.4935,
    lng: 13.562,
    durationSeconds: 20,
    note: 'In bay — west of Piran old town',
  },
  {
    name: 'Morska oaza Piran',
    lat: 45.4882,
    lng: 13.5836,
    durationSeconds: 40,
    note: 'DANGER ZONE - YouSea artificial reef',
  },
  {
    name: 'West of reef',
    lat: 45.4865,
    lng: 13.574,
    durationSeconds: 20,
    note: 'Piran Bay channel',
  },
  {
    name: 'Posidonia meadows (off Fiesa)',
    lat: 45.4895,
    lng: 13.565,
    durationSeconds: 30,
    note: 'DANGER ZONE - seagrass beds',
  },
  {
    name: 'Piran Bay north W',
    lat: 45.4945,
    lng: 13.568,
    durationSeconds: 18,
    note: 'North bay — west of peninsula',
  },
  {
    name: 'Bernardin approach',
    lat: 45.5005,
    lng: 13.582,
    durationSeconds: 18,
    note: 'Bernardin — in Piran Bay water',
  },
  {
    name: 'Marina Portoroz',
    lat: 45.50597,
    lng: 13.5974,
    durationSeconds: 25,
    note: 'Safe mooring area',
  },
];

fs.writeFileSync(simPath, code, 'utf8');
fs.writeFileSync(routePath, `${JSON.stringify(route, null, 2)}\n`, 'utf8');
console.log('Updated', simPath, 'and', routePath);
