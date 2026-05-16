/**
 * Marine zones for the Gulf of Piran demo.
 * Restricted areas: ProtectedSeas Navigator (ArcGIS boundaries + hackathon CSV metadata).
 * Danger areas: YouSea reef sites. Safe areas: OSM marina mooring boxes.
 */

import * as turf from '@turf/turf';
import { sloveniaRestricted } from '../data/slovenia-restricted.data.js';

const DEG = Math.PI / 180;

const KOPER_MARINA = { lng: 13.72782, lat: 45.55022 };
const PORTOROZ_MARINA = { lng: 13.5974, lat: 45.50597 };

function harborBox(lng, lat, halfWidthM, halfSouthM, halfNorthM = halfSouthM) {
  const cosLat = Math.cos(lat * DEG);
  const mToLat = (m) => (m / 6371000) * (180 / Math.PI);
  const mToLng = (m) => (m / (6371000 * cosLat)) * (180 / Math.PI);
  const dLng = mToLng(halfWidthM);
  const dSouth = mToLat(halfSouthM);
  const dNorth = mToLat(halfNorthM);
  return [
    [lng - dLng, lat - dSouth],
    [lng + dLng, lat - dSouth],
    [lng + dLng, lat + dNorth],
    [lng - dLng, lat + dNorth],
    [lng - dLng, lat - dSouth],
  ];
}

function circlePolygon(lng, lat, radiusM, segments = 20) {
  const ring = [];
  const cosLat = Math.cos(lat * DEG);
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * 2 * Math.PI;
    const dx = radiusM * Math.cos(angle);
    const dy = radiusM * Math.sin(angle);
    const dLat = (dy / 6371000) * (180 / Math.PI);
    const dLng = (dx / (6371000 * cosLat)) * (180 / Math.PI);
    ring.push([lng + dLng, lat + dLat]);
  }
  return ring;
}

const PIRAN_OASIS_LAT = 45 + 29 / 60 + 17.5 / 3600;
const PIRAN_OASIS_LNG = 13 + 35 / 60 + 1 / 3600;

/** Normalize Navigator / ArcGIS features for the dashboard zone engine. */
function normalizeRestrictedFeature(feature) {
  const p = feature.properties;
  return {
    type: 'Feature',
    properties: {
      id: p.id,
      name: p.name,
      type: 'restricted',
      reason: p.reason,
      species: p.species ?? ['posidonia', 'date-mussel', 'common-dolphin', 'seahorse'],
      severity: p.severity ?? 'medium',
      authority: p.authority,
      established: p.established ? String(p.established) : '',
      designation: p.designation,
      source: p.source,
      sourceUrl: p.sourceUrl,
      navigatorSiteId: p.navigatorSiteId ?? p.siteId,
      accuracy: p.accuracy,
    },
    geometry: feature.geometry,
  };
}

const youSeaDangerZones = [
  {
    type: 'Feature',
    properties: {
      id: 'piran-oasis',
      name: 'Morska oaza Piran (Sea Oasis Piran)',
      type: 'danger',
      reason:
        'YouSea artificial reef and multitrophic aquaculture structure. Anchoring and bottom contact destroy colonizing habitat.',
      species: [
        'fan-mussel',
        'dusky-grouper',
        'cladocora',
        'mytilus',
        'spider-crab',
        'seahorse',
      ],
      severity: 'high',
      authority: 'Zavod YouSea',
      established: '2024',
      source: 'YouSea.org',
      sourceUrl: 'https://www.yoursea.org/sea-oasis-piran',
      accuracy: 'official_point',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [circlePolygon(PIRAN_OASIS_LNG, PIRAN_OASIS_LAT, 280)],
    },
  },
  {
    type: 'Feature',
    properties: {
      id: 'cladocora',
      name: 'Cladocora structure (Morska oaza Piran)',
      type: 'danger',
      reason:
        'Second YouSea reef unit named for Mediterranean stone coral (Cladocora caespitosa). No anchoring.',
      species: ['cladocora', 'fan-mussel', 'dusky-grouper', 'seahorse'],
      severity: 'high',
      authority: 'Zavod YouSea',
      established: '2025',
      source: 'YouSea.org',
      sourceUrl: 'https://www.yoursea.org/cladocora-development-of-life',
      accuracy: 'official_point',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        circlePolygon(PIRAN_OASIS_LNG + 0.003, PIRAN_OASIS_LAT + 0.0012, 200),
      ],
    },
  },
];

const marinaSafeZones = [
  {
    type: 'Feature',
    properties: {
      id: 'koper-marina',
      name: 'Koper Marina',
      type: 'safe',
      reason: 'Designated mooring zone. Full port services available.',
      species: [],
      severity: 'none',
      authority: 'Luka Koper',
      mooringFee: '€25–45/night',
      source: 'OpenStreetMap',
      accuracy: 'osm_mooring',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [harborBox(KOPER_MARINA.lng, KOPER_MARINA.lat, 95, 70, 55)],
    },
  },
  {
    type: 'Feature',
    properties: {
      id: 'piran-marina',
      name: 'Marina Portorož',
      type: 'safe',
      reason: 'Designated mooring zone. Historic Piran nearby.',
      species: [],
      severity: 'none',
      authority: 'Marina Portorož',
      mooringFee: '€20–35/night',
      source: 'OpenStreetMap',
      accuracy: 'osm_mooring',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        harborBox(PORTOROZ_MARINA.lng, PORTOROZ_MARINA.lat, 100, 75, 55),
      ],
    },
  },
];

const navigatorZones = sloveniaRestricted.features.map(normalizeRestrictedFeature);

export const zones = {
  type: 'FeatureCollection',
  features: [...youSeaDangerZones, ...navigatorZones, ...marinaSafeZones],
};

/** Turf geometry for point-in-polygon tests. */
export function toTurfFeature(feature) {
  const { geometry } = feature;
  if (geometry.type === 'Polygon') {
    return turf.polygon(geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return turf.multiPolygon(geometry.coordinates);
  }
  return null;
}

/** Exterior ring for a zone polygon (GeoJSON [lng, lat]). Handles Polygon rings. */
export function getPolygonRing(feature) {
  const { geometry } = feature;
  if (geometry.type === 'Polygon') {
    let ring = geometry.coordinates[0];
    while (ring.length === 1 && Array.isArray(ring[0]?.[0])) {
      ring = ring[0];
    }
    return ring;
  }
  if (geometry.type === 'MultiPolygon') {
    let largest = geometry.coordinates[0][0];
    let maxLen = largest.length;
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      if (ring.length > maxLen) {
        largest = ring;
        maxLen = ring.length;
      }
    }
    return largest;
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

/** Google Maps LatLngBounds covering all zone polygons. */
export function getZonesBounds() {
  const bounds = { north: -90, south: 90, east: -180, west: 180 };
  const gulfClip = { minLat: 45.44, maxLat: 45.62, minLng: 13.44, maxLng: 13.78 };

  for (const feature of zones.features) {
    for (const [lng, lat] of getPolygonRing(feature)) {
      if (
        lat < gulfClip.minLat ||
        lat > gulfClip.maxLat ||
        lng < gulfClip.minLng ||
        lng > gulfClip.maxLng
      ) {
        continue;
      }
      bounds.north = Math.max(bounds.north, lat);
      bounds.south = Math.min(bounds.south, lat);
      bounds.east = Math.max(bounds.east, lng);
      bounds.west = Math.min(bounds.west, lng);
    }
  }

  if (bounds.north === -90) {
    return { north: 45.55, south: 45.48, east: 13.74, west: 13.54 };
  }
  return bounds;
}

/** Bounding boxes for simulator zone logging (lng/lat min-max). */
export function getZoneBoundingBoxes() {
  return zones.features.map((feature) => {
    const ring = getPolygonRing(feature);
    let minLng = 180;
    let maxLng = -180;
    let minLat = 90;
    let maxLat = -90;
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return {
      id: feature.properties.id,
      name: feature.properties.name,
      type: feature.properties.type,
      minLng,
      maxLng,
      minLat,
      maxLat,
    };
  });
}
