// ═══════════════════════════════════════════════════════════════════
// 🎬 SPELL CINEMATIC SERVICE — Camera intro cinematic universel
//
// Wrap autour de playIslandIntro pour les rooms 3D Three.js :
//   - Plan d'arrivée (bird-eye) → plan interactif (lerp easeInOut)
//   - Voice narrator optionnel synchronisé
//   - Sound enter-1 / portal en début
//   - Hooks onStart / onComplete pour custom logic
//
// Usage minimal dans une room :
//   await this.cinematic.play({
//     camera, controls,
//     start: new THREE.Vector3(0, 30, 30),
//     end:   new THREE.Vector3(0, 6, 10),
//     target:new THREE.Vector3(0, 1, 0),
//     duration: 2.4,
//     voice: "Bienvenue dans la Crypte du Pré-mortem...",
//   });
// ═══════════════════════════════════════════════════════════════════
import { Injectable, inject } from '@angular/core';
import { playIslandIntro } from '../island-intro/island-intro';
import { VoiceNarratorService } from '../voice-narrator/voice-narrator.service';
import { SpellSoundsService, SoundKey } from '../spell-sounds/spell-sounds.service';

export interface CinematicOptions {
  /** THREE.PerspectiveCamera */
  camera: any;
  /** OrbitControls instance */
  controls: any;
  /** Position de départ (bird-eye) — Vector3 */
  start: any;
  /** Position finale (interactive) — Vector3 */
  end: any;
  /** Target (lookAt) — Vector3 */
  target: any;
  /** Durée du lerp en secondes (default 2.4) */
  duration?: number;
  /** Texte vocal optionnel à jouer pendant l'intro */
  voice?: string;
  /** Son SFX en début (default 'enter-1'). Vide ('' as any) pour désactiver. */
  sound?: SoundKey | '';
  /** Hook au début de l'intro */
  onStart?: () => void;
  /** Hook à la fin de l'intro */
  onComplete?: () => void;
}

@Injectable({ providedIn: 'root' })
export class SpellCinematicService {
  private voice = inject(VoiceNarratorService);
  private sounds = inject(SpellSoundsService);

  /** Lance une intro cinématique générique. Retourne une Promise qui resout à la fin. */
  async play(opts: CinematicOptions): Promise<void> {
    opts.onStart?.();
    if (opts.sound !== '') {
      try { this.sounds.play(opts.sound || 'enter-1', { volume: 0.4 }); } catch {}
    }
    const speechPromise = opts.voice
      ? this.voice.speak(opts.voice).catch(() => {})
      : Promise.resolve();

    await playIslandIntro(
      opts.camera,
      opts.controls,
      { x: opts.end.x, y: opts.end.y, z: opts.end.z },
      { x: opts.target.x, y: opts.target.y, z: opts.target.z },
      opts.duration ?? 2.4,
    );
    // Wait for voice to finish too if it's still talking
    await speechPromise;
    opts.onComplete?.();
  }
}
