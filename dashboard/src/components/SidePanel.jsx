import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNow } from '../hooks/useNow';

const VIOLATION_ICONS = {
  'Anchoring in protected zone': '⚓',
  'Speeding in restricted zone': '💨',
  'Illegal fishing': '🎣',
  Other: '📋',
};

function formatTimeAgo(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  return date.toLocaleDateString();
}

function reportsToday(reports) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return reports.filter((r) => {
    const t = r.timestamp?.toDate?.() ?? new Date(r.timestamp);
    return t >= start;
  }).length;
}

export default function SidePanel({
  reports,
  connected,
  lastUpdate,
  usingBridge,
  zoneCheckCount,
  collapsed: collapsedProp,
  onToggleCollapse,
}) {
  const [collapsedLocal, setCollapsedLocal] = useState(false);
  const collapsed = collapsedProp ?? collapsedLocal;
  const toggle =
    onToggleCollapse ?? (() => setCollapsedLocal((c) => !c));

  const now = useNow();
  const feed = (reports ?? []).slice(0, 10);
  const fixAge =
    lastUpdate != null
      ? `${Math.max(0, (now - lastUpdate.getTime()) / 1000).toFixed(1)}s`
      : '—';

  if (collapsed) {
    return (
      <aside className="side-panel side-panel--collapsed panel">
        <button
          type="button"
          className="btn btn--icon side-panel__expand"
          onClick={toggle}
          aria-label="Expand side panel"
        >
          <ChevronRight size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="side-panel panel">
      <header className="side-panel__header">
        <h2 className="side-panel__title">Helm</h2>
        <button
          type="button"
          className="btn btn--icon"
          onClick={toggle}
          aria-label="Collapse side panel"
        >
          <ChevronLeft size={18} />
        </button>
      </header>

      <section className="side-panel__section">
        <h3 className="side-panel__label">Legend</h3>
        <ul className="legend">
          <li>🔴 Danger zone — entry prohibited</li>
          <li>🟠 Restricted — slow / no anchor</li>
          <li>🟢 Safe mooring</li>
          <li>⛵ Your vessel (via Signal K)</li>
        </ul>
      </section>

      <section className="side-panel__section side-panel__section--feed">
        <h3 className="side-panel__label">Live reports</h3>
        {feed.length === 0 ? (
          <p className="side-panel__empty">No reports yet</p>
        ) : (
          <ul className="report-feed">
            {feed.map((r) => {
              const icon = VIOLATION_ICONS[r.violationType] ?? '📋';
              return (
                <li key={r.id} className="report-feed__item panel-raised">
                  <div className="report-feed__head">
                    {icon} {r.violationType ?? 'Report'}
                  </div>
                  <div className="report-feed__meta">
                    {r.zoneName ?? 'Open water'} · {formatTimeAgo(r.timestamp)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="side-panel__section side-panel__status">
        <h3 className="side-panel__label">System status</h3>
        <dl className="status-grid">
          <dt>Signal K</dt>
          <dd>{connected ? '🟢 Connected' : '🔴 Offline'}</dd>
          <dt>Last fix</dt>
          <dd>{fixAge} ago</dd>
          <dt>NMEA source</dt>
          <dd>{usingBridge ? 'WS bridge :3001' : 'TCP :10110'}</dd>
          <dt>Zone checks</dt>
          <dd>{(zoneCheckCount ?? 0).toLocaleString()} this session</dd>
          <dt>Reports</dt>
          <dd>{reportsToday(reports)} today</dd>
        </dl>
      </section>
    </aside>
  );
}
