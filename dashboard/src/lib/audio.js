/** Web Audio alert for zone entry (danger / restricted). */
export function playAlert(type) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === 'danger' ? 880 : 660;
    osc.type = 'sine';
    const duration = type === 'danger' ? 1.5 : 0.8;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio may be blocked until user gesture
  }
}
