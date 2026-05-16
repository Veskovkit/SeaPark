import { X } from 'lucide-react';
import { getSpeciesList } from '../lib/species';
import { countReportsInZone } from '../lib/zoneLookup';

const TYPE_BADGES = {
  danger: { label: 'PROTECTED', className: 'badge-danger' },
  restricted: { label: 'RESTRICTED', className: 'badge-warning' },
  safe: { label: 'SAFE MOORING', className: 'badge-safe' },
};

export default function ZoneInfoPanel({ zone, reports, onClose }) {
  const props = zone.properties ?? zone;
  const badge = TYPE_BADGES[props.type] ?? TYPE_BADGES.safe;
  const species = getSpeciesList(props.species ?? []);
  const reportCount = countReportsInZone(reports, zone);

  return (
    <aside className="zone-panel panel">
      <header className="zone-panel__header">
        <div>
          <h2 className="zone-panel__title">{props.name}</h2>
          <span className={badge.className}>{badge.label}</span>
        </div>
        <button
          type="button"
          className="btn btn--icon"
          onClick={onClose}
          aria-label="Close zone panel"
        >
          <X size={20} />
        </button>
      </header>

      <div className="zone-panel__body">
        <section className="zone-panel__section">
          <h3 className="zone-panel__label">Authority</h3>
          <p>{props.authority}</p>
          {props.established && (
            <p className="zone-panel__meta">Established {props.established}</p>
          )}
        </section>

        <section className="zone-panel__section">
          <h3 className="zone-panel__label">Protection</h3>
          <p>{props.reason}</p>
        </section>

        {species.length > 0 && (
          <section className="zone-panel__section">
            <h3 className="zone-panel__label">Species at risk</h3>
            <ul className="species-list">
              {species.map((s) => (
                <li key={s.id} className="species-card panel-raised">
                  <div className="species-card__head">
                    <span className="species-card__emoji">{s.emoji}</span>
                    <div>
                      <strong>{s.nickname}</strong>
                      <em className="species-card__sci">{s.scientificName}</em>
                    </div>
                  </div>
                  <span
                    className="species-card__status"
                    style={{ color: s.statusColor, borderColor: s.statusColor }}
                  >
                    {s.status}
                  </span>
                  <p className="species-card__fact">{s.fact}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="zone-panel__section">
          <h3 className="zone-panel__label">Active reports</h3>
          <p className="zone-panel__report-count">{reportCount} in this zone</p>
        </section>

        {props.type === 'safe' && props.mooringFee && (
          <section className="zone-panel__section">
            <h3 className="zone-panel__label">Mooring</h3>
            <p>{props.mooringFee}</p>
          </section>
        )}
      </div>
    </aside>
  );
}
