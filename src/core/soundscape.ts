/**
 * Star Icons — the soundscapes controller.
 *
 * Bridges settings + icon interactions to the SoundEngine:
 *   • hover  -> subtle "click"
 *   • pick   -> the icon's own sound (star = twinkle, trash = crash, …)
 *   • change -> "transition" when a file's icon changes automatically
 *
 * Also owns loading/clearing custom .mp3/.wav files (stored in the vault).
 */

import { App } from "obsidian";
import { SoundEngine, soundKindForIcon } from "./audio";
import { IconDef, SoundKind, SoundPackId, StarIconsSettings } from "../types";

export class SoundscapeController {
  private engine = new SoundEngine();
  private lastHoverAt = 0;

  constructor(
    private getSettings: () => StarIconsSettings,
    private app: App,
  ) {}

  private intensity(): number {
    return this.getSettings().soundIntensity / 100;
  }

  /** Hover an icon tile: subtle, throttled. */
  hover(icon?: IconDef | null): void {
    const s = this.getSettings();
    if (!s.soundscapesEnabled || !s.soundHover) return;
    const now = Date.now();
    if (now - this.lastHoverAt < 130) return;
    this.lastHoverAt = now;
    this.engine.play("click", s.soundPack, this.intensity() * 0.45);
  }

  /** Pick/click an icon: its own sound, more pronounced. */
  pick(icon?: IconDef | null): void {
    const s = this.getSettings();
    if (!s.soundscapesEnabled || !s.soundClick) return;
    const kind = icon ? soundKindForIcon(icon.id) : "select";
    this.engine.play(kind, s.soundPack, Math.min(1, this.intensity() * 1.25));
  }

  /** Automatic icon change (rules/vault events). */
  transition(): void {
    const s = this.getSettings();
    if (!s.soundscapesEnabled || !s.soundTransition) return;
    this.engine.play("transition", s.soundPack, this.intensity() * 0.9);
  }

  /** Explicit preview of a kind (settings tests, detail panel). */
  playKind(kind: SoundKind, intensity?: number): void {
    const s = this.getSettings();
    if (!s.soundscapesEnabled) return;
    this.engine.play(kind, s.soundPack, intensity ?? Math.min(1, this.intensity() * 1.1));
  }

  /** Preview the sound an icon is classified as (Icon Manager detail). */
  playIcon(icon: IconDef, intensity = 0.7): void {
    const s = this.getSettings();
    if (!s.soundscapesEnabled) return;
    this.engine.play(soundKindForIcon(icon.id), s.soundPack, intensity);
  }

  /** Load every configured custom sound file into the engine. */
  async preloadCustom(): Promise<void> {
    const s = this.getSettings();
    for (const [kind, path] of Object.entries(s.customSounds)) {
      if (path) await this.loadCustom(kind as SoundKind, path);
    }
  }

  /** Load one custom sound file; resolves true when it decodes. */
  async loadCustom(kind: SoundKind, path: string): Promise<boolean> {
    try {
      const data = await this.app.vault.adapter.readBinary(path);
      return await this.engine.decode(kind, data);
    } catch {
      return false;
    }
  }

  clearCustom(kind: SoundKind): void {
    this.engine.clearCustom(kind);
  }

  hasCustom(kind: SoundKind): boolean {
    return this.engine.hasCustom(kind);
  }

  /** For the settings UI: current pack id. */
  currentPack(): SoundPackId {
    return this.getSettings().soundPack;
  }
}
