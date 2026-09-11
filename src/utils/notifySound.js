// Generates a short, pleasant two-tone notification beep using the Web
// Audio API directly — no mp3/wav asset needed, so this always works
// offline and never risks a missing-file error.
export function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    const now = ctx.currentTime
    playTone(880, now, 0.14)        // first "ding"
    playTone(1174.66, now + 0.13, 0.18) // second, higher "ding"

    // Auto-close the context shortly after so we don't leak audio nodes
    setTimeout(() => ctx.close().catch(() => {}), 500)
  } catch {
    // Silent failure — notification sound is a nice-to-have, never block the app on it
  }
}
