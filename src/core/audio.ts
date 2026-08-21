/**
 * Star Icons — the sound engine (Web Audio API).
 *
 * Synthesizes short sound effects for icon interactions — no audio files
 * required. Three built-in packs (8-bit / cinematic / minimal) shape the
 * same kinds of sounds, and users can override any kind with their own
 * .mp3/.wav buffer.
 *
 * This module has zero Obsidian dependencies (pure Web Audio + types), so
 * the classification logic is unit-testable in isolation.
 */

import { SoundKind, SoundPackId } from "../types";

/* --- icon -> sound classification --------------------------------------- */

const KIND_RULES: [RegExp, SoundKind][] = [
  [/(star|sparkle|glitter|twinkle|shine|shiny|spark)/, "twinkle"],
  [/(trash|delete|remove|bomb|explosion|destroy|boom|dump)/, "crash"],
  [/(bell|notification|alert|alarm|ring|notif|siren)/, "ding"],
  [/(heart|love|romance|kiss)/, "chime"],
  [/(plus|add|new|create|bubble)/, "pop"],
  [/(music|note|song|melody|audio|sound|headphone)/, "chime"],
];

/**
 * Classify an icon by its id/name into a sound kind (star -> twinkle,
 * trash -> crash, bell -> ding, …). Unknown icons get the neutral "click".
 */
export function soundKindForIcon(nameOrId: string): SoundKind {
  const s = nameOrId.toLowerCase();
  for (const [re, kind] of KIND_RULES) {
    if (re.test(s)) return kind;
  }
  return "click";
}

/* --- synthesis ------------------------------------------------------------ */

interface Tone {
  /** Start frequency (Hz). */
  f: number;
  /** Optional ramp target frequency (glissando). */
  f2?: number;
  /** Start offset (seconds). */
  t: number;
  /** Duration (seconds). */
  d: number;
  w?: OscillatorType;
  /** Relative gain (0..1). */
  g?: number;
}

interface KindSpec {
  tones?: Tone[];
  /** Noise-burst duration in seconds (0/absent = none). */
  noise?: number;
  noiseFilter?: { type: BiquadFilterType; freq: number; freq2?: number; q?: number };
  noiseGain?: number;
  /** Low sine "thud" frequency (crash body). */
  thud?: number;
  /** Overall gain multiplier for the whole kind. */
  master?: number;
  attack?: number;
  release?: number;
  /** Feedback-delay echo (cinematic pack). */
  echo?: { delay: number; feedback: number };
}

type PackSpec = Record<SoundKind, KindSpec>;

const SINE: OscillatorType = "sine";
const SQUARE: OscillatorType = "square";

const MINIMAL: PackSpec = {
  click: { tones: [{ f: 880, t: 0, d: 0.05, w: SINE, g: 0.5 }], master: 0.5, attack: 0.003, release: 0.04 },
  select: { tones: [{ f: 660, t: 0, d: 0.09, w: SINE }, { f: 990, t: 0.05, d: 0.12, w: SINE }], master: 0.6, attack: 0.003, release: 0.08 },
  transition: {
    noise: 0.16,
    noiseFilter: { type: "bandpass", freq: 500, freq2: 1500, q: 1.2 },
    noiseGain: 0.35,
    master: 0.7,
    attack: 0.005,
    release: 0.1,
  },
  twinkle: {
    tones: [
      { f: 1046, t: 0, d: 0.22, w: SINE, g: 0.5 },
      { f: 1318, t: 0.06, d: 0.24, w: SINE, g: 0.5 },
      { f: 1568, t: 0.12, d: 0.28, w: SINE, g: 0.55 },
      { f: 2093, t: 0.2, d: 0.4, w: SINE, g: 0.6 },
    ],
    master: 0.55,
    attack: 0.004,
    release: 0.15,
  },
  crash: {
    noise: 0.28,
    noiseFilter: { type: "lowpass", freq: 1500, freq2: 250, q: 0.6 },
    noiseGain: 0.6,
    thud: 70,
    master: 0.6,
    attack: 0.003,
    release: 0.2,
  },
  ding: { tones: [{ f: 1568, t: 0, d: 0.55, w: SINE, g: 0.55 }], master: 0.6, attack: 0.002, release: 0.3 },
  pop: { tones: [{ f: 520, f2: 780, t: 0, d: 0.09, w: SINE, g: 0.6 }], master: 0.55, attack: 0.003, release: 0.06 },
  chime: {
    tones: [
      { f: 784, t: 0, d: 0.25, w: SINE, g: 0.5 },
      { f: 988, t: 0.09, d: 0.35, w: SINE, g: 0.5 },
    ],
    master: 0.55,
    attack: 0.004,
    release: 0.2,
  },
};

const EIGHT_BIT: PackSpec = {
  click: { tones: [{ f: 660, t: 0, d: 0.04, w: SQUARE, g: 0.45 }], master: 0.5, attack: 0.002, release: 0.03 },
  select: { tones: [{ f: 523, f2: 784, t: 0, d: 0.1, w: SQUARE, g: 0.5 }], master: 0.55, attack: 0.002, release: 0.05 },
  transition: { tones: [{ f: 220, f2: 880, t: 0, d: 0.18, w: SQUARE, g: 0.45 }], master: 0.6, attack: 0.002, release: 0.06 },
  twinkle: {
    tones: [
      { f: 1318, t: 0, d: 0.1, w: SQUARE, g: 0.5 },
      { f: 1568, t: 0.05, d: 0.1, w: SQUARE, g: 0.5 },
      { f: 1976, t: 0.1, d: 0.12, w: SQUARE, g: 0.55 },
      { f: 2637, t: 0.16, d: 0.2, w: SQUARE, g: 0.6 },
    ],
    master: 0.5,
    attack: 0.002,
    release: 0.08,
  },
  crash: {
    noise: 0.22,
    noiseFilter: { type: "lowpass", freq: 900, freq2: 150, q: 0.8 },
    noiseGain: 0.6,
    thud: 60,
    master: 0.55,
    attack: 0.002,
    release: 0.15,
  },
  ding: { tones: [{ f: 1318, t: 0, d: 0.3, w: SQUARE, g: 0.5 }], master: 0.55, attack: 0.002, release: 0.15 },
  pop: { tones: [{ f: 440, f2: 660, t: 0, d: 0.07, w: SQUARE, g: 0.5 }], master: 0.5, attack: 0.002, release: 0.04 },
  chime: {
    tones: [
      { f: 880, t: 0, d: 0.12, w: SQUARE, g: 0.5 },
      { f: 1108, t: 0.06, d: 0.16, w: SQUARE, g: 0.5 },
    ],
    master: 0.5,
    attack: 0.002,
    release: 0.08,
  },
};

const CINEMATIC: PackSpec = {
  click: { tones: [{ f: 440, t: 0, d: 0.08, w: SINE, g: 0.5 }], master: 0.55, attack: 0.006, release: 0.12, echo: { delay: 0.18, feedback: 0.25 } },
  select: {
    tones: [
      { f: 392, t: 0, d: 0.16, w: SINE, g: 0.5 },
      { f: 587, t: 0.1, d: 0.24, w: SINE, g: 0.5 },
    ],
    master: 0.6,
    attack: 0.008,
    release: 0.2,
    echo: { delay: 0.22, feedback: 0.3 },
  },
  transition: {
    noise: 0.4,
    noiseFilter: { type: "bandpass", freq: 300, freq2: 900, q: 1.1 },
    noiseGain: 0.4,
    tones: [{ f: 196, f2: 392, t: 0.05, d: 0.35, w: SINE, g: 0.3 }],
    master: 0.7,
    attack: 0.01,
    release: 0.3,
    echo: { delay: 0.28, feedback: 0.35 },
  },
  twinkle: {
    tones: [
      { f: 784, t: 0, d: 0.45, w: SINE, g: 0.5 },
      { f: 988, t: 0.1, d: 0.5, w: SINE, g: 0.5 },
      { f: 1175, t: 0.2, d: 0.55, w: SINE, g: 0.55 },
      { f: 1568, t: 0.32, d: 0.7, w: SINE, g: 0.6 },
    ],
    master: 0.55,
    attack: 0.008,
    release: 0.3,
    echo: { delay: 0.25, feedback: 0.3 },
  },
  crash: {
    noise: 0.45,
    noiseFilter: { type: "lowpass", freq: 2000, freq2: 150, q: 0.7 },
    noiseGain: 0.6,
    thud: 55,
    master: 0.65,
    attack: 0.005,
    release: 0.35,
    echo: { delay: 0.24, feedback: 0.3 },
  },
  ding: { tones: [{ f: 1174, t: 0, d: 0.9, w: SINE, g: 0.55 }], master: 0.6, attack: 0.003, release: 0.45, echo: { delay: 0.3, feedback: 0.35 } },
  pop: { tones: [{ f: 330, f2: 494, t: 0, d: 0.14, w: SINE, g: 0.55 }], master: 0.55, attack: 0.006, release: 0.14, echo: { delay: 0.2, feedback: 0.25 } },
  chime: {
    tones: [
      { f: 587, t: 0, d: 0.4, w: SINE, g: 0.5 },
      { f: 740, t: 0.1, d: 0.45, w: SINE, g: 0.5 },
      { f: 880, t: 0.2, d: 0.5, w: SINE, g: 0.5 },
    ],
    master: 0.55,
    attack: 0.008,
    release: 0.3,
    echo: { delay: 0.26, feedback: 0.3 },
  },
};

const PACKS: Record<SoundPackId, PackSpec> = {
  "8bit": EIGHT_BIT,
  cinematic: CINEMATIC,
  minimal: MINIMAL,
};

/* --- player ---------------------------------------------------------------- */

const noiseCache = new WeakMap<AudioContext, AudioBuffer>();

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (buf) return buf;
  const len = Math.floor(ctx.sampleRate * 0.5);
  buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}

function playTone(
  ctx: AudioContext,
  tone: Tone,
  out: AudioNode,
  attack: number,
  release: number,
  master: number,
): void {
  const t0 = ctx.currentTime + Math.max(0, tone.t);
  const osc = ctx.createOscillator();
  osc.type = tone.w ?? SINE;
  osc.frequency.setValueAtTime(Math.max(1, tone.f), t0);
  if (tone.f2) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.f2), t0 + tone.d);
  }
  const g = ctx.createGain();
  const peak = Math.max(0.0002, (tone.g ?? 1) * master);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.d);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + tone.d + release + 0.05);
}

function playNoise(
  ctx: AudioContext,
  spec: KindSpec,
  out: AudioNode,
  master: number,
): void {
  const dur = spec.noise ?? 0.1;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = spec.noiseFilter?.type ?? "lowpass";
  filter.Q.value = spec.noiseFilter?.q ?? 0.7;
  filter.frequency.setValueAtTime(spec.noiseFilter?.freq ?? 1200, t0);
  if (spec.noiseFilter?.freq2) {
    filter.frequency.exponentialRampToValueAtTime(spec.noiseFilter.freq2, t0 + dur);
  }
  const g = ctx.createGain();
  const peak = Math.max(0.0002, (spec.noiseGain ?? 0.5) * master);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function playSpec(
  ctx: AudioContext,
  spec: KindSpec,
  out: AudioNode,
  intensity: number,
): void {
  const attack = spec.attack ?? 0.004;
  const release = spec.release ?? 0.12;
  const master = (spec.master ?? 1) * intensity;

  const bus = ctx.createGain();
  bus.gain.value = 1;
  if (spec.echo) {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = spec.echo.delay;
    const feedback = ctx.createGain();
    feedback.gain.value = spec.echo.feedback;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(out);
    bus.connect(delay);
  }
  bus.connect(out);

  if (spec.noise) playNoise(ctx, spec, bus, master);
  if (spec.thud) {
    playTone(ctx, { f: spec.thud, t: 0, d: Math.max(0.18, spec.noise ?? 0.12), w: SINE, g: 0.7 }, bus, 0.004, 0.15, master);
  }
  for (const tone of spec.tones ?? []) playTone(ctx, tone, bus, attack, release, master);
}

/* --- engine ---------------------------------------------------------------- */

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private custom = new Map<SoundKind, AudioBuffer>();

  /** Lazily create/resume the AudioContext (must follow a user gesture). */
  ensureCtx(): AudioContext | null {
    try {
      const w = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AC = w.AudioContext ?? w.webkitAudioContext;
      if (!AC) return null;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Decode + cache a custom audio buffer for a kind. */
  async decode(kind: SoundKind, data: ArrayBuffer): Promise<boolean> {
    const ctx = this.ensureCtx();
    if (!ctx) return false;
    try {
      // decodeAudioData detaches the buffer — hand it a copy.
      const buffer = await ctx.decodeAudioData(data.slice(0));
      this.custom.set(kind, buffer);
      return true;
    } catch {
      return false;
    }
  }

  setCustom(kind: SoundKind, buffer: AudioBuffer): void {
    this.custom.set(kind, buffer);
  }

  clearCustom(kind: SoundKind): void {
    this.custom.delete(kind);
  }

  hasCustom(kind: SoundKind): boolean {
    return this.custom.has(kind);
  }

  /**
   * Play a kind. `intensity` 0..1. Custom buffers override the synthesis.
   * Returns false when muted/unavailable (callers can ignore).
   */
  play(kind: SoundKind, pack: SoundPackId, intensity: number): boolean {
    if (intensity <= 0.01) return false;
    if (typeof document !== "undefined" && document.hidden) return false;
    const ctx = this.ensureCtx();
    if (!ctx) return false;

    const master = ctx.createGain();
    master.gain.value = Math.min(1, 0.9 * intensity);
    master.connect(ctx.destination);

    const custom = this.custom.get(kind);
    if (custom) {
      const src = ctx.createBufferSource();
      src.buffer = custom;
      src.connect(master);
      src.start();
      return true;
    }
    playSpec(ctx, PACKS[pack]?.[kind] ?? MINIMAL[kind], master, intensity);
    return true;
  }
}
