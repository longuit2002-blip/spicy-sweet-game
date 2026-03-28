/**
 * Lightweight Web Audio SFX for reveal / challenge outcome (no asset files).
 * Respects `localStorage` {@link GAME_SFX_MUTED_STORAGE_KEY} when set to `"1"`.
 */

const GAME_SFX_MUTED_STORAGE_KEY = "sweet-spicy-game-sfx-muted";

type WindowWithWebKit = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as WindowWithWebKit;
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!sharedCtx) sharedCtx = createAudioContext();
  return sharedCtx;
}

function isSfxMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(GAME_SFX_MUTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

async function ensureRunning(ctx: AudioContext): Promise<void> {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* autoplay policies */
    }
  }
}

function connectToDestination(ctx: AudioContext, node: AudioNode): void {
  node.connect(ctx.destination);
}

/** Optional: wire a settings toggle; `"1"` mutes all reveal SFX. */
export function setGameRevealSfxMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GAME_SFX_MUTED_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export { GAME_SFX_MUTED_STORAGE_KEY };

/** Soft whoosh as the declared card begins to flip face-up. */
export async function playRevealCardFlipSound(): Promise<void> {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  await ensureRunning(ctx);
  const t0 = ctx.currentTime;
  const duration = 0.26;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(420, t0);
  osc.frequency.exponentialRampToValueAtTime(95, t0 + duration * 0.85);

  const level = 0.085;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(level, t0 + 0.028);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  connectToDestination(ctx, gain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Short bright arpeggio when the local seat wins the challenge resolution. */
export async function playChallengeWinSound(): Promise<void> {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  await ensureRunning(ctx);
  const t0 = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99] as const;
  const step = 0.07;
  const level = 0.055;

  notes.forEach((freq, i) => {
    const t = t0 + i * step;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.35);
    osc.connect(gain);
    connectToDestination(ctx, gain);
    osc.start(t);
    osc.stop(t + step * 1.5);
  });
}

/** Low sting when the local seat loses the challenge resolution. */
export async function playChallengeLoseSound(): Promise<void> {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  await ensureRunning(ctx);
  const t0 = ctx.currentTime;
  const dur = 0.38;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(155, t0);
  osc.frequency.exponentialRampToValueAtTime(72, t0 + dur);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(0.045, t0 + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain);
  connectToDestination(ctx, gain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}
