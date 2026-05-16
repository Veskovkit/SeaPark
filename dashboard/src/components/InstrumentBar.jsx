import { Anchor, Loader2 } from 'lucide-react';
import { toMaritime } from '../lib/coords';
import { useNow } from '../hooks/useNow';

export default function InstrumentBar({
  sog,
  cog,
  position,
  connected,
  lastUpdate,
  usingBridge,
}) {
  const posLabel = position
    ? `${toMaritime(position.lat, true)}  ${toMaritime(position.lng, false)}`
    : '—  —';

  const now = useNow();
  const fixAge =
    lastUpdate != null
      ? `${Math.max(0, (now - lastUpdate.getTime()) / 1000).toFixed(1)}s`
      : null;

  return (
    <header className="instrument-bar">
      <div className="instrument-bar__left">
        <Anchor size={18} strokeWidth={2.25} aria-hidden />
        <span className="instrument-bar__brand">SEAPARK</span>
      </div>

      <div className="instrument-bar__instruments">
        <div className="instrument-group">
          <span className="instrument-label">SOG</span>
          <span className="instrument">{sog != null ? `${sog} kn` : '— kn'}</span>
        </div>
        <div className="instrument-sep" />
        <div className="instrument-group">
          <span className="instrument-label">COG</span>
          <span className="instrument">{cog != null ? `${cog}°` : '—°'}</span>
        </div>
        <div className="instrument-sep" />
        <div className="instrument-group instrument-group--pos">
          <span className="instrument-label">Position</span>
          <span className="instrument instrument--pos">{posLabel}</span>
        </div>
      </div>

      <div className="instrument-bar__status">
        {!connected && (
          <Loader2 className="instrument-bar__spinner" size={14} aria-hidden />
        )}
        <span
          className={
            connected ? 'status-live instrument-bar__live' : 'instrument-bar__nosignal'
          }
        >
          {connected ? '🟢 LIVE' : '🔴 NO SIGNAL'}
        </span>
        {connected && fixAge && (
          <span className="instrument-bar__fix-age">fix {fixAge} ago</span>
        )}
        {usingBridge && connected && (
          <span className="instrument-bar__bridge">bridge</span>
        )}
      </div>
    </header>
  );
}
