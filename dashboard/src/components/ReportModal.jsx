import { useEffect, useMemo, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, storage, ensureAuth } from '../lib/firebase';
import { toMaritime } from '../lib/coords';
import { findZoneAt } from '../lib/zoneLookup';
import { getSpeciesList } from '../lib/species';
import { useGemini } from '../hooks/useGemini';

const VIOLATION_TYPES = [
  'Anchoring in protected zone',
  'Speeding in restricted zone',
  'Illegal fishing',
  'Waste dumping',
  'Suspicious activity',
  'Other',
];

const SEVERITY_ICON = { high: '🔴', medium: '🟠', low: '🟡' };

export default function ReportModal({ location, activeZone, onClose }) {
  const { analyzeViolationPhoto, analyzing, error: geminiError, clearError } =
    useGemini();

  const [violationType, setViolationType] = useState(VIOLATION_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [step, setStep] = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);

  const clickZone = useMemo(
    () => (location ? findZoneAt(location.lat, location.lng) : null),
    [location],
  );

  const zoneFeature = clickZone ?? activeZone;
  const zoneProps = zoneFeature?.properties;
  const zoneName = zoneProps?.name ?? 'Open water';
  const zoneContext = zoneName;

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalysis(null);
    setStep('form');
    clearError();
  };

  const readFileBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = String(result).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAnalyzeAndPreview = async (e) => {
    e.preventDefault();
    if (!location || !photoFile) {
      toast.error('Add a photo to submit a report.');
      return;
    }

    setSubmitting(true);
    clearError();

    try {
      const user = await ensureAuth();
      const timestamp = Date.now();
      const storageRef = ref(
        storage,
        `reports/${user.uid}/${timestamp}.jpg`,
      );
      await uploadBytes(storageRef, photoFile);
      const url = await getDownloadURL(storageRef);
      setPhotoUrl(url);

      const base64 = await readFileBase64(photoFile);
      const geminiResult = await analyzeViolationPhoto(
        base64,
        photoFile.type,
        zoneContext,
      );
      setAnalysis(geminiResult);
      setStep('preview');
    } catch (err) {
      toast.error(err.message ?? 'Could not process report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!location) return;
    setSubmitting(true);

    try {
      const user = await ensureAuth();
      await addDoc(collection(db, 'reports'), {
        lat: location.lat,
        lng: location.lng,
        violationType,
        notes: notes.trim() || null,
        photoUrl: photoUrl ?? null,
        geminiAnalysis: analysis,
        zoneId: zoneProps?.id ?? null,
        zoneName,
        timestamp: serverTimestamp(),
        userId: user.uid,
        status: 'pending',
        source: 'seapark-helm-v1',
      });
      toast.success('Report submitted to coast guard feed.');
      onClose();
    } catch (err) {
      toast.error(err.message ?? 'Failed to save report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!location) return null;

  const species = getSpeciesList(zoneProps?.species ?? []);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal panel"
        role="dialog"
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id="report-modal-title">Violation Report</h2>
          <button
            type="button"
            className="btn btn--icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        {step === 'form' && (
          <form className="modal__body" onSubmit={handleAnalyzeAndPreview}>
            <label className="field">
              <span className="field__label">Location</span>
              <span className="field__readonly instrument">
                {toMaritime(location.lat, true)} ·{' '}
                {toMaritime(location.lng, false)}
              </span>
            </label>

            <label className="field">
              <span className="field__label">Zone</span>
              <span className="field__readonly">{zoneName}</span>
              {species.length > 0 && (
                <span className="field__hint">
                  {species.map((s) => s.emoji).join(' ')} nearby
                </span>
              )}
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
              <span className="field__label">Photo evidence</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Report preview"
                  className="modal__photo-preview"
                />
              )}
            </label>

            <label className="field">
              <span className="field__label">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe what you observed…"
              />
            </label>

            {geminiError && <p className="field__error">{geminiError}</p>}

            <footer className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting || analyzing || !photoFile}
              >
                {(submitting || analyzing) && (
                  <Loader2 className="btn__spinner" size={16} />
                )}
                {analyzing ? 'Analyzing…' : 'Analyze & Preview'}
              </button>
            </footer>
          </form>
        )}

        {step === 'preview' && analysis && (
          <div className="modal__body">
            <div className="ai-preview panel-raised">
              <h3>🤖 AI Analysis</h3>
              <p>
                <strong>Detected:</strong> {analysis.detected}
              </p>
              <p>
                <strong>Severity:</strong>{' '}
                {SEVERITY_ICON[analysis.severity] ?? '🟠'}{' '}
                {String(analysis.severity).toUpperCase()}
              </p>
              {analysis.speciesAtRisk?.length > 0 && (
                <p>
                  <strong>Species at risk:</strong>{' '}
                  {analysis.speciesAtRisk.join(', ')}
                </p>
              )}
              <p>
                <strong>Confidence:</strong> {analysis.confidence}
              </p>
              <p>
                <strong>Recommendation:</strong> {analysis.recommendation}
              </p>
            </div>

            <footer className="modal__footer">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleConfirmSubmit}
                disabled={submitting}
              >
                {submitting && <Loader2 className="btn__spinner" size={16} />}
                Confirm & Submit
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
