#!/usr/bin/env node
/**
 * Build slovenia-restricted.json from hackathon CSV + ProtectedSeas ArcGIS boundaries.
 * CSV geometry column is truncated; polygons come from Navigator_AllSites FeatureServer.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const csvPath =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'CSV ZA HAKATON.csv');
const outJsonPath = path.join(root, 'dashboard', 'src', 'data', 'slovenia-restricted.geojson');
const outJsPath = path.join(root, 'dashboard', 'src', 'data', 'slovenia-restricted.data.js');

const ARCGIS_QUERY =
  'https://services9.arcgis.com/lm7wE8a9YA9rKfzy/arcgis/rest/services/Navigator_AllSites_010925_attributes/FeatureServer/0/query';

/** Sites to omit from the helm chart (too large or non-marine for demo). */
const EXCLUDE_SITE_IDS = new Set(['AISVN1']); // Slovenia EEZ

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = values[i]?.trim() ?? '';
    });
    return row;
  });
}

function slugId(siteId) {
  return siteId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function mapSeverity(categoryName, siteName) {
  const c = (categoryName || '').toLowerCase();
  const n = (siteName || '').toLowerCase();
  if (c.includes('fish reserve') || n.includes('ribi')) return 'high';
  return 'medium';
}

function ringAreaKm2(ring) {
  if (!ring || ring.length < 3) return 0;
  const R = 6371;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    area +=
      ((lng2 - lng1) * DEG) *
      (2 + Math.sin(lat1 * DEG) + Math.sin(lat2 * DEG));
  }
  return Math.abs((area * R * R) / 2);
}

const DEG = Math.PI / 180;

function normalizeRing(ring) {
  if (!ring?.length) return ring;
  const closed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  return closed ? ring : [...ring, ring[0]];
}

async function fetchGeometries(siteIds) {
  const chunkSize = 15;
  const features = [];
  for (let i = 0; i < siteIds.length; i += chunkSize) {
    const chunk = siteIds.slice(i, i + chunkSize);
    const where = `SITE_ID IN ('${chunk.join("','")}')`;
    const url = `${ARCGIS_QUERY}?${new URLSearchParams({
      where,
      outFields: 'SITE_ID,site_name,country,designation,category_name,purpose,year_est,marine_area,percent_marine,navigator_link,managing_authority',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
    })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ArcGIS query failed: ${res.status}`);
    const geo = await res.json();
    if (geo.error) throw new Error(geo.error.message || JSON.stringify(geo.error));
    features.push(...(geo.features || []));
  }
  return features;
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const siteIds = rows.map((r) => r.SITE_ID).filter(Boolean);
  const rowById = Object.fromEntries(rows.map((r) => [r.SITE_ID, r]));

  console.log(`CSV rows: ${rows.length}, fetching ${siteIds.length} geometries from ArcGIS...`);
  const arcFeatures = await fetchGeometries(siteIds);
  const arcById = Object.fromEntries(
    arcFeatures.map((f) => [f.properties.SITE_ID, f]),
  );

  const features = [];
  for (const row of rows) {
    const siteId = row.SITE_ID;
    if (EXCLUDE_SITE_IDS.has(siteId)) {
      console.log(`  skip ${siteId} (excluded)`);
      continue;
    }

    const arc = arcById[siteId];
    if (!arc?.geometry) {
      console.warn(`  missing geometry for ${siteId}`);
      continue;
    }

    const geom = arc.geometry;
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') {
      console.warn(`  skip ${siteId}: ${geom.type}`);
      continue;
    }

    let coordinates = geom.coordinates;
    if (geom.type === 'Polygon') {
      coordinates = [normalizeRing(coordinates[0])];
    }

    const marinePct = parseFloat(row.percent_marine) || 0;
    const marineKm2 = parseFloat(row.marine_area) || 0;
    if (marinePct < 5 && marineKm2 < 0.001) {
      console.log(`  skip ${siteId} (minimal marine area)`);
      continue;
    }

    const ring = coordinates[0];
    const areaKm2 = ringAreaKm2(ring);
    if (areaKm2 > 500) {
      console.log(`  skip ${siteId} (area ${areaKm2.toFixed(0)} km² too large)`);
      continue;
    }

    features.push({
      type: 'Feature',
      properties: {
        id: slugId(siteId),
        siteId,
        name: row.site_name || arc.properties.site_name,
        type: 'restricted',
        reason: row.purpose || arc.properties.purpose || 'Protected marine or coastal area.',
        species: ['posidonia', 'date-mussel', 'common-dolphin', 'seahorse'],
        severity: mapSeverity(row.category_name, row.site_name),
        authority: row.managing_authority || arc.properties.managing_authority || '',
        established: row.year_est || arc.properties.year_est || '',
        designation: row.designation || arc.properties.designation || '',
        categoryName: row.category_name || arc.properties.category_name || '',
        source: 'ProtectedSeas Navigator',
        sourceUrl: row.navigator_link || arc.properties.navigator_link || '',
        navigatorSiteId: siteId,
        accuracy: 'navigator_arcgis',
        marineAreaKm2: marineKm2,
        percentMarine: marinePct,
      },
      geometry: {
        type: 'Polygon',
        coordinates,
      },
    });
  }

  const collection = {
    type: 'FeatureCollection',
    metadata: {
      source: 'ProtectedSeas Navigator ArcGIS + hackathon CSV attributes',
      generatedAt: new Date().toISOString(),
      csvPath,
    },
    features,
  };

  fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(outJsonPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outJsPath,
    `/** Auto-generated — do not edit. Run: node scripts/import-slovenia-zones.mjs */\nexport const sloveniaRestricted = ${JSON.stringify(collection)};\n`,
    'utf8',
  );
  console.log(`Wrote ${outJsonPath} and ${outJsPath} (${features.length} zones)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
