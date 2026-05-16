/** Gulf of Piran marine zones — GeoJSON (Navigator, YouSea, habitat sources). */

const DEG = Math.PI / 180;

/** Approximate circle polygon (meters) for point-based sites. */
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

/** Piran Oasis — YouSea official coordinates 45°29'17.5"N 13°35'01.0"E */
const PIRAN_OASIS_LAT = 45 + 29 / 60 + 17.5 / 3600;
const PIRAN_OASIS_LNG = 13 + 35 / 60 + 1 / 3600;

export const zones = {
  type: 'FeatureCollection',
  features: [
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
        coordinates: [circlePolygon(PIRAN_OASIS_LNG, PIRAN_OASIS_LAT, 450)],
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
        coordinates: [circlePolygon(PIRAN_OASIS_LNG + 0.003, PIRAN_OASIS_LAT + 0.0012, 280)],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'posidonia-beds',
        name: 'Posidonia oceanica meadows',
        type: 'danger',
        reason:
          'Protected seagrass beds along the Fiesa–Piran coast. Posidonia is endemic to the Mediterranean; anchor scars take decades to recover.',
        species: ['posidonia', 'loggerhead-turtle', 'seahorse', 'date-mussel'],
        severity: 'high',
        authority: 'Slovenian Environment Agency',
        established: '2010',
        source: 'EMODnet / EU Maritime Forum',
        sourceUrl:
          'https://maritime-forum.ec.europa.eu/map-week-seagrass-meadows-posidonia-oceanica_en',
        accuracy: 'habitat_emodnet_approx',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.548, 45.494],
            [13.572, 45.492],
            [13.578, 45.504],
            [13.568, 45.512],
            [13.552, 45.510],
            [13.548, 45.494],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'strunjan-reserve',
        name: 'Krajinski park Strunjan (marine)',
        type: 'restricted',
        reason:
          'Landscape park marine zone: no waste dumping, habitat protection, Natura 2000 SI5000031. Follow park speed and anchoring rules.',
        species: ['posidonia', 'date-mussel', 'common-dolphin', 'seahorse'],
        severity: 'medium',
        authority: 'Ministrstvo za okolje in prostor',
        established: '1990',
        source: 'ProtectedSeas Navigator',
        sourceUrl: 'https://map.navigatormap.org/site-detail?site_id=37670',
        navigatorSiteId: '37670',
        lfp: 1,
        accuracy: 'navigator_boundary',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.592, 45.514],
            [13.602, 45.512],
            [13.618, 45.518],
            [13.626, 45.528],
            [13.622, 45.538],
            [13.608, 45.542],
            [13.594, 45.538],
            [13.590, 45.526],
            [13.592, 45.514],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'debeli-rtic',
        name: 'Krajinski park Debeli rtič (marine)',
        type: 'restricted',
        reason:
          'Protected coastal and marine landscape near Ankaran. Species include seahorse and Mediterranean stony coral.',
        species: ['seahorse', 'cladocora', 'posidonia'],
        severity: 'medium',
        authority: 'Občina Ankaran',
        established: '1990',
        source: 'ProtectedSeas Navigator',
        sourceUrl: 'https://map.navigatormap.org/site-detail?site_id=37665',
        navigatorSiteId: '37665',
        lfp: 2,
        accuracy: 'navigator_boundary',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.632, 45.578],
            [13.648, 45.576],
            [13.656, 45.588],
            [13.648, 45.596],
            [13.634, 45.594],
            [13.632, 45.578],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'croatia-mpa-gulf',
        name: 'Croatian marine managed area (Gulf of Piran)',
        type: 'restricted',
        reason:
          'Croatian waters in the Gulf of Piran — follow national fishing and anchoring regulations (ProtectedSeas Navigator).',
        species: ['common-dolphin', 'loggerhead-turtle'],
        severity: 'medium',
        authority: 'Republic of Croatia',
        source: 'ProtectedSeas Navigator',
        sourceUrl:
          'https://map.navigatormap.org/areas?site_id=AIHRV22_c&z=14',
        navigatorSiteId: 'AIHRV22_c',
        lfp: 2,
        accuracy: 'navigator_boundary',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.488, 45.462],
            [13.528, 45.458],
            [13.538, 45.478],
            [13.512, 45.488],
            [13.488, 45.462],
          ],
        ],
      },
    },
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
        source: 'Port of Koper',
        accuracy: 'mooring_approx',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.724, 45.546],
            [13.738, 45.546],
            [13.738, 45.554],
            [13.724, 45.554],
            [13.724, 45.546],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'piran-marina',
        name: 'Marina Portorož / Piran',
        type: 'safe',
        reason: 'Designated mooring zone. Historic Piran nearby.',
        species: [],
        severity: 'none',
        authority: 'Marina Portorož',
        mooringFee: '€20–35/night',
        source: 'Marina operator',
        accuracy: 'mooring_approx',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.564, 45.526],
            [13.574, 45.526],
            [13.574, 45.532],
            [13.564, 45.532],
            [13.564, 45.526],
          ],
        ],
      },
    },
  ],
};

/** Google Maps LatLngBounds covering all zone polygons. */
export function getZonesBounds() {
  const bounds = { north: -90, south: 90, east: -180, west: 180 };
  for (const feature of zones.features) {
    for (const [lng, lat] of feature.geometry.coordinates[0]) {
      bounds.north = Math.max(bounds.north, lat);
      bounds.south = Math.min(bounds.south, lat);
      bounds.east = Math.max(bounds.east, lng);
      bounds.west = Math.min(bounds.west, lng);
    }
  }
  return bounds;
}

/** Bounding boxes for simulator zone logging (lng/lat min-max). */
export function getZoneBoundingBoxes() {
  return zones.features.map((feature) => {
    const ring = feature.geometry.coordinates[0];
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
