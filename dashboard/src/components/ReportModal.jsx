import { useMemo, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, ensureAuth } from '../lib/firebase';
import { toMaritime } from '../lib/coords';

const VIOLATION_TYPES = [
  'Anchoring in protected zone',
  'Speeding in restricted zone',
  'Illegal fishing',
  'Other',
];

export default function ReportModal({ position, activeZone, onClose }) {
  const [violationType, setViolationType] = useState(VIOLATION_TYPES[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const zoneProps = activeZone?.properties;
  const zoneName = zoneProps?.name ?? 'Open water';

  const locationLabel = useMemo(() => {
    if (!position) return '—';
    return `${toMaritime(position.lat, true)}  ${toMaritime(position.lng, false)}`;
  }, [position]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position) return;

    setSubmitting(true);
    try {
      const user = await ensureAuth();
      await addDoc(collection(db, 'reports'), {
        lat: position.lat,
        lng: position.lng,
        violationType,
        note: note.trim(),
        zoneId: zoneProps?.id ?? null,
        zoneName,
        timestamp: serverTimestamp(),
        userId: user.uid,
        status: 'pending',
        source: 'seapark-helm-v1',
      });
      toast.success('Report submitted to authorities');
      onClose();
    } catch (err) {
      toast.error(err.message ?? 'Failed to save report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!position) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="modal panel"
        role="dialog"
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="modal__header">
          <h2 id="report-modal-title">⚠️ Report a Violation</h2>
          <button
            type="button"
            className="btn btn--icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        <div className="modal__body">
          <label className="field">
            <span className="field__label">Location</span>
            <span className="field__readonly instrument">{locationLabel}</span>
          </label>

          <label className="field">
            <span className="field__label">Zone</span>
            <span className="field__readonly">{zoneName}</span>
          </label>

          <label className="field">
            <span className="field__label">Violation type</span>
            <select
              value={violationType}
              onChange={(e) => setViolationType(e.target.value)}
            >
              {VIOLATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </label>
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting && <Loader2 className="btn__spinner" size={16} />}
            Submit Report →
          </button>
        </footer>
      </form>
    </div>
  );
}
