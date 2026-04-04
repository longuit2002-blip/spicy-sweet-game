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

export type PenaltyResolutionSfxRole = "pile" | "draw" | "spectator";
export type PenaltyResolutionSfxVariant = "caught" | "truth" | "timeout";

const PENALTY_SFX_GAIN_PILE = 0.092;
const PENALTY_SFX_GAIN_DRAW = 0.1;
const PENALTY_SFX_GAIN_SPECTATOR = 0.078;
const PENALTY_SFX_STACK_STEP_S = 0.055;

/** Layered stinger when the round-resolution (`PENALTY`) overlay appears — stronger than REVEAL win/lose beeps. */
export async function playPenaltyResolutionSound(
  role: PenaltyResolutionSfxRole,
  variant: PenaltyResolutionSfxVariant,
): Promise<void> {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  await ensureRunning(ctx);

  const pitchBoost =
    variant === "caught" ? 1.06 : variant === "timeout" ? 1.03 : 1;
  const t0 = ctx.currentTime;

  if (role === "pile") {
    const level = PENALTY_SFX_GAIN_PILE * pitchBoost;
    const freqs = [392 * pitchBoost, 493.88 * pitchBoost, 587.33 * pitchBoost, 659.25 * pitchBoost] as const;
    freqs.forEach((freq, i) => {
      const t = t0 + i * PENALTY_SFX_STACK_STEP_S;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + PENALTY_SFX_STACK_STEP_S * 1.55);
      osc.connect(gain);
      connectToDestination(ctx, gain);
      osc.start(t);
      osc.stop(t + PENALTY_SFX_STACK_STEP_S * 1.75);
    });
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(118 * pitchBoost, t0);
    boom.frequency.exponentialRampToValueAtTime(52, t0 + 0.28);
    boomGain.gain.setValueAtTime(0.0001, t0);
    boomGain.gain.linearRampToValueAtTime(0.055 * pitchBoost, t0 + 0.05);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    boom.connect(boomGain);
    connectToDestination(ctx, boomGain);
    boom.start(t0);
    boom.stop(t0 + 0.48);
    return;
  }

  if (role === "draw") {
    const level = PENALTY_SFX_GAIN_DRAW * (variant === "caught" ? 1.08 : 1);
    const dur = 0.52;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(190 * pitchBoost, t0);
    osc.frequency.exponentialRampToValueAtTime(68, t0 + dur * 0.92);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(level, t0 + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    connectToDestination(ctx, gain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);

    const knockT = t0 + 0.08;
    for (let i = 0; i < 2; i++) {
      const kT = knockT + i * 0.12;
      const kOsc = ctx.createOscillator();
      const kGain = ctx.createGain();
      kOsc.type = "square";
      kOsc.frequency.setValueAtTime(84, kT);
      kGain.gain.setValueAtTime(0.0001, kT);
      kGain.gain.linearRampToValueAtTime(0.028, kT + 0.012);
      kGain.gain.exponentialRampToValueAtTime(0.0001, kT + 0.09);
      kOsc.connect(kGain);
      connectToDestination(ctx, kGain);
      kOsc.start(kT);
      kOsc.stop(kT + 0.1);
    }
    return;
  }

  const level = PENALTY_SFX_GAIN_SPECTATOR;
  const freqs = [311.13 * pitchBoost, 415.3 * pitchBoost] as const;
  freqs.forEach((freq, i) => {
    const t = t0 + i * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain);
    connectToDestination(ctx, gain);
    osc.start(t);
    osc.stop(t + 0.28);
  });
}

/** Two-note ascending stinger when turn advances (NEXT_TURN or new `PLAYER_TURN` seat). */
export async function playTurnHandoffStinger(): Promise<void> {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  await ensureRunning(ctx);
  const t0 = ctx.currentTime;
  const level = 0.072;

  const freqs = [392, 523.25] as const;
  const step = 0.09;

  freqs.forEach((freq, i) => {
    const t = t0 + i * step;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.15);
    osc.connect(gain);
    connectToDestination(ctx, gain);
    osc.start(t);
    osc.stop(t + step * 1.4);
  });
}
