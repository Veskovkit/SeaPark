import * as turf from '@turf/turf';
import { zones, toTurfFeature } from './zones';

const ZONE_PRIORITY = { danger: 0, restricted: 1, safe: 2 };

const sortedFeatures = [...zones.features].sort(
  (a, b) =>
    (ZONE_PRIORITY[a.properties.type] ?? 99) -
    (ZONE_PRIORITY[b.properties.type] ?? 99),
);

/** Point-in-polygon zone at lat/lng (danger > restricted > safe). */
export function findZoneAt(lat, lng) {
  const point = turf.point([lng, lat]);
  for (const feature of sortedFeatures) {
    const polygon = turf.polygon(feature.geometry.coordinates);
    if (turf.booleanPointInPolygon(point, polygon)) {
      return feature;
    }
  }
  return null;
}

export function countReportsInZone(reports, feature) {
  if (!feature || !reports?.length) return 0;
  const polygon = toTurfFeature(feature);
  if (!polygon) return 0;
  return reports.filter((r) => {
    if (r.lat == null || r.lng == null) return false;
    return turf.booleanPointInPolygon(turf.point([r.lng, r.lat]), polygon);
  }).length;
}
