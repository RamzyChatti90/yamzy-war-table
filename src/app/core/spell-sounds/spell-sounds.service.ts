// ═══════════════════════════════════════════════════════════════════
// 🎵 SPELL SOUNDS — Mini SoundController (calque sur spell-caster)
//
// Joue les MP3 du spell-caster :
//   music.mp3        → musique boucle en arrière-plan
//   ping-1, ping-2   → transitions / clics
//   crystal-reform   → quand le crystal apparaît
//   enter-1          → entrée dans une room
//   torch-1          → allumage torche
//   portal           → ouverture portail
//
// Web Audio API obligatoire → nécessite une interaction user d'abord.
// ═══════════════════════════════════════════════════════════════════
import { Injectable, signal } from '@angular/core';

export type SoundKey =
  | 'music' | 'ping-1' | 'ping-2' | 'crystal-reform'
  | 'enter-1' | 'torch-1' | 'portal';

const SOUND_PATHS: Record<SoundKey, string> = {
  'music': '/assets/conclave/sounds/music.mp3',
  'ping-1': '/assets/conclave/sounds/ping-1.mp3',
  'ping-2': '/assets/conclave/sounds/ping-2.mp3',
  'crystal-reform': '/assets/conclave/sounds/crystal-reform.mp3',
  'enter-1': '/assets/conclave/sounds/enter-1.mp3',
  'torch-1': '/assets/conclave/sounds/torch-1.mp3',
  'portal': '/assets/conclave/sounds/portal.mp3',
};

@Injectable({ providedIn: 'root' })
export class SpellSoundsService {
  muted = signal<boolean>(false);
  musicVolume = 0.35;
  sfxVolume = 0.6;

  private buffers: Map<SoundKey, AudioBuffer> = new Map();
  private context: AudioContext | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicStarted = false;

  /** Lazy-init de l'AudioContext (politique browser) */
  private async ensureContext(): Promise<AudioContext | null> {
    if (this.context) return this.context;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      this.context = new Ctx();
      return this.context;
    } catch (e) {
      console.warn('[SpellSounds] AudioContext init failed', e);
      return null;
    }
  }

  /** Charge un son à la demande (cache buffer) */
  private async loadBuffer(key: SoundKey): Promise<AudioBuffer | null> {
    if (this.buffers.has(key)) return this.buffers.get(key)!;
    const ctx = await this.ensureContext();
    if (!ctx) return null;
    try {
      const res = await fetch(SOUND_PATHS[key]);
      const arr = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arr);
      this.buffers.set(key, buffer);
      return buffer;
    } catch (e) {
      console.warn(`[SpellSounds] failed to load ${key}`, e);
      return null;
    }
  }

  /** Précharge plusieurs sons (utile au boot) */
  async preload(keys: SoundKey[]): Promise<void> {
    await Promise.all(keys.map(k => this.loadBuffer(k)));
  }

  /** Joue un SFX one-shot */
  async play(key: SoundKey, opts?: { volume?: number }): Promise<void> {
    if (this.muted()) return;
    const ctx = await this.ensureContext();
    if (!ctx) return;
    const buf = await this.loadBuffer(key);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = (opts?.volume ?? this.sfxVolume);
    src.connect(g).connect(ctx.destination);
    try { src.start(0); } catch {}
  }

  /** Démarre la musique en boucle (idempotent) */
  async startMusic(): Promise<void> {
    if (this.musicStarted) return;
    if (this.muted()) return;
    const ctx = await this.ensureContext();
    if (!ctx) return;
    const buf = await this.loadBuffer('music');
    if (!buf) return;
    this.musicSource = ctx.createBufferSource();
    this.musicSource.buffer = buf;
    this.musicSource.loop = true;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicSource.connect(this.musicGain).connect(ctx.destination);
    try { this.musicSource.start(0); } catch {}
    // Fade-in
    const now = ctx.currentTime;
    this.musicGain.gain.linearRampToValueAtTime(this.musicVolume, now + 2);
    this.musicStarted = true;
  }

  stopMusic(): void {
    if (!this.musicSource) return;
    try { this.musicSource.stop(0); } catch {}
    this.musicSource = null;
    this.musicGain = null;
    this.musicStarted = false;
  }

  toggleMute(): void {
    this.muted.update(m => !m);
    if (this.muted() && this.musicGain && this.context) {
      this.musicGain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.4);
    } else if (!this.muted() && this.musicGain && this.context) {
      this.musicGain.gain.linearRampToValueAtTime(this.musicVolume, this.context.currentTime + 0.4);
    }
  }
}
