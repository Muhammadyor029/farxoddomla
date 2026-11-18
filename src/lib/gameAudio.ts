// Lightweight Web Audio API synthesized micro-FX for interactive legal games

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === "suspended") {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function playGameSfx(
  kind: "click" | "snap" | "correct" | "wrong" | "victory",
  enabled = true
) {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const tone = (freq: number, startOffset: number, duration: number, type: OscillatorType, gainVal: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(gainVal, now + startOffset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    if (kind === "click") {
      tone(520, 0, 0.045, "sine", 0.035);
    } else if (kind === "snap") {
      tone(660, 0, 0.06, "triangle", 0.045);
    } else if (kind === "correct") {
      tone(523.25, 0, 0.1, "sine", 0.055);
      tone(659.25, 0.07, 0.14, "sine", 0.06);
    } else if (kind === "wrong") {
      tone(220, 0, 0.11, "triangle", 0.055);
      tone(175, 0.09, 0.14, "triangle", 0.05);
    } else if (kind === "victory") {
      tone(523.25, 0, 0.11, "sine", 0.05);
      tone(659.25, 0.09, 0.11, "sine", 0.055);
      tone(783.99, 0.18, 0.14, "sine", 0.06);
      tone(1046.5, 0.28, 0.24, "sine", 0.065);
    }
  } catch {
    // Audio playback blocked or unsupported in sandbox; safely ignore
  }
}
