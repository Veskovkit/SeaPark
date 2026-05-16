import { Marker } from '@react-google-maps/api';

const SEVERITY_COLORS = {
  high: '#ef4444',
  medium: '#f97316',
  low: '#eab308',
};

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

export default function ReportPins({ reports, onReportClick }) {
  if (!reports?.length) return null;

  return reports.map((report) => {
    if (report.lat == null || report.lng == null) return null;
    const severity = report.geminiAnalysis?.severity ?? 'medium';
    const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.medium;

    return (
      <Marker
        key={report.id}
        position={{ lat: report.lat, lng: report.lng }}
        icon={pinIcon(color)}
        title={report.geminiAnalysis?.autoTag ?? report.violationType ?? 'Report'}
        onClick={() => onReportClick?.(report)}
      />
    );
  });
}
