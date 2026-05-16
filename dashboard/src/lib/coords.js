/** Decimal degrees → maritime DD°MM.MM'N/S/E/W */
export function toMaritime(decimal, isLat) {
  if (decimal == null || Number.isNaN(decimal)) return '—';
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const min = ((abs - deg) * 60).toFixed(2);
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  return `${deg}°${min}'${dir}`;
}
