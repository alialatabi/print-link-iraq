/**
 * Play a short notification chime using Web Audio API.
 * No external audio file needed.
 */
export const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);       // A5
    osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1); // C#6
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.2); // E6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Silently fail if audio not supported
  }
};
