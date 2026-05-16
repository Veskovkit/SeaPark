import { useState, useEffect, useRef } from 'react';
import * as turf from '@turf/turf';
import { zones } from '../lib/zones';

const ZONE_PRIORITY = { danger: 0, restricted: 1, safe: 2 };

const sortedFeatures = [...zones.features].sort(
  (a, b) =>
    (ZONE_PRIORITY[a.properties.type] ?? 99) -
    (ZONE_PRIORITY[b.properties.type] ?? 99),
);

export function useZoneEngine(position) {
  const [activeZone, setActiveZone] = useState(null);
  const [zoneHistory, setZoneHistory] = useState([]);
  const prevZoneId = useRef(null);

  // Zone transitions are driven by the position stream (Signal K / bridge).
  /* eslint-disable react-hooks/set-state-in-effect -- sync zone state to vessel position */
  useEffect(() => {
    if (!position) return;

    const point = turf.point([position.lng, position.lat]);
    let found = null;

    for (const feature of sortedFeatures) {
      const polygon = turf.polygon(feature.geometry.coordinates);
      if (turf.booleanPointInPolygon(point, polygon)) {
        found = feature;
        break;
      }
    }

    const newId = found?.properties?.id ?? null;

    if (newId === prevZoneId.current) return;

    prevZoneId.current = newId;
    setActiveZone(found);

    if (!found) return;

    setZoneHistory((prev) =>
      [
        {
          zone: found.properties,
          enteredAt: new Date(),
          position: { ...position },
        },
        ...prev,
      ].slice(0, 20),
    );
  }, [position]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { activeZone, zoneHistory };
}
