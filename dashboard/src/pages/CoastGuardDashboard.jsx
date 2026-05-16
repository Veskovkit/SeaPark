// TODO: add role-based auth before production

import { useCallback, useMemo, useState } from 'react';
import {
  GoogleMap,
  LoadScript,
  Polygon,
  Marker,
  InfoWindow,
} from '@react-google-maps/api';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { zones, getZonesBounds, getPolygonRing } from '../lib/zones';
import { toMaritime } from '../lib/coords';
import { useReports } from '../hooks/useReports';
import { db } from '../lib/firebase';
import { useNow } from '../hooks/useNow';

const MAP_CENTER = { lat: 45.505, lng: 13.575 };
const MAP_ZOOM = 12;

const mapOptions = {
  mapTypeId: 'hybrid',
  mapTypeControlOptions: {
    mapTypeIds: ['hybrid', 'satellite', 'roadmap'],
  },
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

const VIOLATION_ICONS = {
  'Anchoring in protected zone': '⚓',
  'Speeding in restricted zone': '💨',
  'Illegal fishing': '🎣',
  Other: '📋',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'reviewed', label: 'Reviewed' },
];

function pinIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path fill="${color}" stroke="#fff" stroke-width="1.5"
        d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z"/>
      <circle cx="14" cy="14" r="5" fill="#fff"/>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: 28, height: 36 },
    anchor: { x: 14, y: 36 },
  };
}

function formatTimeAgo(ts, now) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((now - date.getTime()) / 1000);
  if (sec < 60) return `${sec} seconds ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} minutes ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  return date.toLocaleDateString();
}

function matchesFilter(report, filter) {
  if (filter === 'all') return true;
  if (filter === 'pending') return report.status === 'pending';
  if (filter === 'reviewed') return report.status === 'reviewed';
  return true;
}

export default function CoastGuardDashboard() {
  const { reports, loading, error } = useReports();
  const [filter, setFilter] = useState('all');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const now = useNow();

  const zoneBounds = useMemo(() => getZonesBounds(), []);

  const filteredReports = useMemo(
    () => reports.filter((r) => matchesFilter(r, filter)),
    [reports, filter],
  );

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );

  const handleMapLoad = useCallback(
    (mapInstance) => {
      mapInstance.fitBounds(zoneBounds, { top: 48, right: 24, bottom: 24, left: 24 });
    },
    [zoneBounds],
  );

  const markReviewed = async (reportId) => {
    setReviewingId(reportId);
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'reviewed' });
      toast.success('Marked as reviewed');
    } catch (err) {
      toast.error(err.message ?? 'Could not update report.');
    } finally {
      setReviewingId(null);
    }
  };

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  return (
    <div className="cg-app">
      <header className="cg-header">
        <h1 className="cg-header__title">🛡️ SeaPark — Coast Guard Dashboard</h1>
      </header>

      <div className="cg-main">
        <aside className="cg-feed panel">
          <div className="cg-filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`cg-filter-btn${filter === f.id ? ' cg-filter-btn--active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="cg-feed__body">
            {loading && <p className="cg-feed__empty">Loading reports…</p>}
            {error && (
              <p className="cg-feed__error">
                Could not load reports. Check Firebase configuration.
              </p>
            )}
            {!loading && !error && filteredReports.length === 0 && (
              <p className="cg-feed__empty">No reports in this filter.</p>
            )}
            <ul className="cg-report-list">
              {filteredReports.map((r) => {
                const icon = VIOLATION_ICONS[r.violationType] ?? '📋';
                const isPending = r.status === 'pending';
                return (
                  <li
                    key={r.id}
                    className={`cg-report-card panel-raised${selectedReportId === r.id ? ' cg-report-card--selected' : ''}`}
                    onClick={() => setSelectedReportId(r.id)}
                  >
                    <div className="cg-report-card__head">
                      {isPending ? '🔴' : '⚪'} {icon} {r.violationType}
                    </div>
                    <p className="cg-report-card__zone">{r.zoneName ?? 'Open water'}</p>
                    <p className="cg-report-card__coords">
                      {toMaritime(r.lat, true)} {toMaritime(r.lng, false)}
                    </p>
                    <p className="cg-report-card__time">
                      {formatTimeAgo(r.timestamp, now)}
                    </p>
                    {r.note ? (
                      <p className="cg-report-card__note">Note: &ldquo;{r.note}&rdquo;</p>
                    ) : null}
                    {isPending && (
                      <button
                        type="button"
                        className="btn btn--primary cg-report-card__action"
                        disabled={reviewingId === r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          markReviewed(r.id);
                        }}
                      >
                        Mark as Reviewed
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <div className="cg-map-wrap">
          {!apiKey ? (
            <div className="cg-map cg-map--missing-key">
              <p>
                Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env</code> to load
                the map.
              </p>
            </div>
          ) : (
            <LoadScript googleMapsApiKey={apiKey}>
              <GoogleMap
                mapContainerClassName="cg-map"
                center={MAP_CENTER}
                zoom={MAP_ZOOM}
                options={mapOptions}
                onLoad={handleMapLoad}
                onClick={() => setSelectedReportId(null)}
              >
                {zones.features.map((feature) => {
                  const type = feature.properties.type;
                  const style = ZONE_STYLES[type] ?? ZONE_STYLES.safe;
                  const paths = getPolygonRing(feature).map(([lng, lat]) => ({
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
                        clickable: false,
                      }}
                    />
                  );
                })}

                {filteredReports.map((report) => {
                  if (report.lat == null || report.lng == null) return null;
                  const color =
                    report.status === 'reviewed' ? '#6b7280' : '#ef4444';
                  return (
                    <Marker
                      key={report.id}
                      position={{ lat: report.lat, lng: report.lng }}
                      icon={pinIcon(color)}
                      onClick={() => setSelectedReportId(report.id)}
                    />
                  );
                })}

                {selectedReport && selectedReport.lat != null && (
                  <InfoWindow
                    position={{
                      lat: selectedReport.lat,
                      lng: selectedReport.lng,
                    }}
                    onCloseClick={() => setSelectedReportId(null)}
                  >
                    <div className="cg-info">
                      <strong>{selectedReport.violationType}</strong>
                      <p>{selectedReport.zoneName ?? 'Open water'}</p>
                      <p>{formatTimeAgo(selectedReport.timestamp, now)}</p>
                      {selectedReport.note ? <p>{selectedReport.note}</p> : null}
                      <p className="cg-info__status">
                        Status: {selectedReport.status ?? 'pending'}
                      </p>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </LoadScript>
          )}
        </div>
      </div>
    </div>
  );
}
