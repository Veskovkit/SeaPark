import { X } from 'lucide-react';
import { getSpeciesList } from '../lib/species';

export default function AlertBanner({ zone, onReport, onViewSpecies, onClose }) {
  const isDanger = zone.type === 'danger';
  const species = getSpeciesList(zone.species ?? []);

  if (zone.type === 'safe') return null;

  return (
    <div
      className={`alert-banner ${isDanger ? 'alert-banner--danger' : 'alert-banner--restricted'}`}
      role="alert"
    >
      <div className="alert-banner__content">
        {isDanger ? (
          <>
            <h2 className="alert-banner__title">
              🚨 DANGER ZONE — {zone.name}
            </h2>
            {species.length > 0 && (
              <p className="alert-banner__species">
                Species at risk:{' '}
                {species.map((s) => `${s.emoji} ${s.nickname}`).join(' · ')}
              </p>
            )}
            <p className="alert-banner__reason">
              {zone.reason} Move vessel to safe water immediately.
            </p>
          </>
        ) : (
          <>
            <h2 className="alert-banner__title alert-banner__title--restricted">
              ⚠️ Restricted Zone — {zone.name}
            </h2>
            <p className="alert-banner__reason">
              {zone.reason}
            </p>
          </>
        )}
      </div>

      <div className="alert-banner__actions">
        <button type="button" className="btn btn--primary" onClick={onReport}>
          Report Violation
        </button>
        <button type="button" className="btn btn--ghost" onClick={onViewSpecies}>
          View Species
        </button>
        {onClose && (
          <button
            type="button"
            className="btn btn--icon"
            onClick={onClose}
            aria-label="Dismiss alert"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
