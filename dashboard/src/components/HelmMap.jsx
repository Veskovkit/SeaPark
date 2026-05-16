import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GoogleMap,
  LoadScript,
  Polygon,
  Polyline,
  Marker,
} from '@react-google-maps/api';
import { zones, getZonesBounds } from '../lib/zones';
import ReportPins from './ReportPins';

const MAP_CENTER = { lat: 45.505, lng: 13.575 };
const MAP_ZOOM = 12;

const mapOptions = {
  mapTypeId: 'hybrid',
  mapTypeControlOptions: {
    mapTypeIds: ['hybrid', 'satellite', 'roadmap'],
  },
  styles: [
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#0a2a4a' }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#00d4ff' }],
    },
  ],
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
};

const ZONE_Z_INDEX = { danger: 3, restricted: 2, safe: 1 };

const ZONE_STYLES = {
  danger: {
    fillColor: '#ef4444',
    fillOpacity: 0.32,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  },
  restricted: {
    fillColor: '#f97316',
    fillOpacity: 0.26,
    strokeColor: '#ea580c',
    strokeWeight: 2,
  },
  safe: {
    fillColor: '#22c55e',
    fillOpacity: 0.18,
    strokeColor: '#16a34a',
    strokeWeight: 2,
  },
};

function vesselIcon(cog = 0, sog = 0) {
  const headingLen = Math.min(28, 12 + Number(sog || 0) * 2);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <g transform="rotate(${cog} 24 24)">
        <line x1="24" y1="24" x2="24" y2="${24 - headingLen}" stroke="#00d4ff" stroke-width="2"/>
        <path d="M24 8 L30 22 L24 20 L18 22 Z" fill="#ffffff" stroke="#00d4ff" stroke-width="1.5"/>
      </g>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 48, height: 48 },
    anchor: { x: 24, y: 24 },
  };
}

export default function HelmMap({
  position,
  cog,
  sog,
  reports,
  onZoneClick,
  onMapRightClick,
  onReportClick,
}) {
  const [wakePath, setWakePath] = useState([]);

  const zoneBounds = useMemo(() => getZonesBounds(), []);

  const handleMapLoad = useCallback(
    (mapInstance) => {
      mapInstance.fitBounds(zoneBounds, { top: 56, right: 24, bottom: 24, left: 24 });
    },
    [zoneBounds],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- wake trail follows position stream */
  useEffect(() => {
    if (position?.lat == null || position?.lng == null) return;
    setWakePath((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.lat === position.lat && last.lng === position.lng) {
        return prev;
      }
      return [...prev, { lat: position.lat, lng: position.lng }].slice(-10);
    });
  }, [position]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const handleRightClick = (e) => {
    if (!e.latLng) return;
    onMapRightClick?.({
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
    });
  };

  if (!apiKey) {
    return (
      <div className="helm-map helm-map--missing-key">
        <p>Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env</code> to load the chart.</p>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={apiKey}>
      <GoogleMap
        mapContainerClassName="helm-map"
        center={position ?? MAP_CENTER}
        zoom={MAP_ZOOM}
        options={mapOptions}
        onLoad={handleMapLoad}
        onRightClick={handleRightClick}
      >
        {zones.features.map((feature) => {
          const type = feature.properties.type;
          const style = ZONE_STYLES[type] ?? ZONE_STYLES.safe;
          const paths = feature.geometry.coordinates[0].map(([lng, lat]) => ({
            lat,
            lng,
          }));

          return (
            <Polygon
              key={feature.properties.id}
              paths={paths}
              options={{
                ...style,
                zIndex: ZONE_Z_INDEX[type] ?? 1,
                clickable: true,
              }}
              onClick={() => onZoneClick?.(feature)}
            />
          );
        })}

        {wakePath.length > 1 && (
          <Polyline
            path={wakePath}
            options={{
              strokeColor: '#00d4ff',
              strokeOpacity: 0.35,
              strokeWeight: 3,
              geodesic: true,
            }}
          />
        )}

        {position && (
          <Marker
            position={position}
            icon={vesselIcon(cog ?? 0, sog ?? 0)}
            zIndex={1000}
          />
        )}

        <ReportPins reports={reports} onReportClick={onReportClick} />
      </GoogleMap>
    </LoadScript>
  );
}
