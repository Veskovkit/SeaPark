/**
 * NMEA 0183 parsing (shared with simulator bridge fallback path).
 * Converts DDMM.MMMM / DDDMM.MMMM fields to decimal degrees.
 */
export function parseNMEA(value, dir) {
  const deg = Math.floor(parseFloat(value) / 100);
  const min = parseFloat(value) - deg * 100;
  const decimal = deg + min / 60;
  return dir === 'S' || dir === 'W' ? -decimal : decimal;
}

/** Parse a valid $GPRMC sentence into position, SOG, COG, and timestamp. */
export function parseGPRMC(sentence) {
  const parts = sentence.split(',');
  if (parts[0] !== '$GPRMC' || parts[2] !== 'A') return null;

  const lat = parseNMEA(parts[3], parts[4]);
  const lng = parseNMEA(parts[5], parts[6]);
  const sog = parseFloat(parts[7]) || 0;
  const cog = parseFloat(parts[8]) || 0;

  return { lat, lng, sog, cog, ts: Date.now() };
}
