#!/usr/bin/env node
/** Writes simulator/zone-data.json from dashboard zones (run after editing zones.js). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { zones, getZoneBoundingBoxes } from '../dashboard/src/lib/zones.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'simulator', 'zone-data.json');

const payload = {
  type: zones.type,
  features: zones.features.map((f) => ({
    type: 'Feature',
    properties: {
      id: f.properties.id,
      name: f.properties.name,
      type: f.properties.type,
    },
    geometry: f.geometry,
  })),
  boundingBoxes: getZoneBoundingBoxes(),
};

fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${out} (${payload.features.length} zones)`);
