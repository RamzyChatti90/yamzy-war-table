// ════════════════════════════════════════════════════════════════════
// 🎬 ANIM CUE HELPER — style jeu cinematique pour rooms
//
// Permet aux rooms d'implémenter facilement onAnimCue(cue) en
// déclenchant des animations standardisées (pulse, glow, bounce,
// rotate, highlight-id, etc.) sur n'importe quel Three.js Object3D.
//
// USAGE depuis une room :
//   import { AnimCueController } from '../../core/narrator/anim-cue.helper';
//
//   private cueCtrl = new AnimCueController();
//
//   // Dans ngOnInit ou bootstrap :
//   this.cueCtrl.setTargets(this.objectsRoot);  // Group Three.js contenant les meshes
//
//   // Méthode appelée par narrator.service.ts :
//   onAnimCue(cue: string | null): void {
//     this.cueCtrl.setCue(cue);
//   }
//
//   // Dans le render loop :
//   this.cueCtrl.tick();
//
//   // Reset quand tutorial se ferme :
//   this.cueCtrl.reset();
// ════════════════════════════════════════════════════════════════════

export type AnimCueName =
  | 'pulse-all'
  | 'highlight-center'
  | 'glow-ring'
  | 'bounce'
  | 'rotate-root'
  | 'shake'
  | 'fade-pulse';

export class AnimCueController {
  private currentCue: string | null = null;
  private cueT0 = 0;
  /** Group ou Object3D contenant les meshes à animer. */
  private root: any = null;

  /** Set le root (Group Three.js) dont on anime les children. */
  setTargets(root: any): void {
    this.root = root;
  }

  /** Change le cue actif (null = reset). */
  setCue(cue: string | null): void {
    if (cue === this.currentCue) return;
    if (!cue) {
      this.reset();
      this.currentCue = null;
      return;
    }
    // Snapshot baseline avant nouveau cue
    this.snapshotBaseline();
    this.currentCue = cue;
    this.cueT0 = performance.now();
  }

  /** Tick à appeler chaque frame depuis le render loop de la room. */
  tick(): void {
    if (!this.currentCue || !this.root) return;
    const t = (performance.now() - this.cueT0) / 1000;
    switch (this.currentCue) {
      case 'pulse-all':       this.cuePulseAll(t); break;
      case 'highlight-center':this.cueHighlightCenter(t); break;
      case 'glow-ring':       this.cueGlowRing(t); break;
      case 'bounce':          this.cueBounce(t); break;
      case 'rotate-root':     this.cueRotateRoot(t); break;
      case 'shake':           this.cueShake(t); break;
      case 'fade-pulse':      this.cueFadePulse(t); break;
    }
  }

  /** Reset toutes les transforms aux valeurs d'origine. */
  reset(): void {
    if (!this.root) return;
    this.root.children.forEach((b: any) => {
      if (b.userData._baseY !== undefined) b.position.y = b.userData._baseY;
      if (b.userData._baseRotY !== undefined) b.rotation.y = b.userData._baseRotY;
      b.scale.setScalar(b.userData._baseScale ?? 1);
      b.traverse((c: any) => {
        if (c.isMesh && c.userData._baseEmissive !== undefined && c.material?.emissive) {
          c.material.emissiveIntensity = c.userData._baseEmissive;
        }
        if (c.isMesh && c.userData._baseOpacity !== undefined && c.material) {
          c.material.opacity = c.userData._baseOpacity;
        }
      });
    });
    if (this.root.userData._baseRotY !== undefined) {
      this.root.rotation.y = this.root.userData._baseRotY;
    }
  }

  // ─── Snapshot pour pouvoir reset ───
  private snapshotBaseline(): void {
    if (!this.root) return;
    if (this.root.userData._baseRotY === undefined) {
      this.root.userData._baseRotY = this.root.rotation.y;
    }
    this.root.children.forEach((b: any) => {
      if (b.userData._baseY === undefined) b.userData._baseY = b.position.y;
      if (b.userData._baseRotY === undefined) b.userData._baseRotY = b.rotation.y;
      if (b.userData._baseScale === undefined) b.userData._baseScale = b.scale.x;
      b.traverse((c: any) => {
        if (c.isMesh && c.material?.emissive && c.userData._baseEmissive === undefined) {
          c.userData._baseEmissive = c.material.emissiveIntensity ?? 0;
        }
        if (c.isMesh && c.material && c.userData._baseOpacity === undefined) {
          c.userData._baseOpacity = c.material.opacity ?? 1;
        }
      });
    });
  }

  // ═══ CUES ═══════════════════════════════════════════════════════
  private cuePulseAll(t: number): void {
    const s = 1 + Math.sin(t * 2) * 0.05;
    this.root.children.forEach((b: any) => {
      b.scale.setScalar((b.userData._baseScale ?? 1) * s);
    });
  }

  private cueHighlightCenter(t: number): void {
    // 1er enfant ou celui marqué `isCenter` / `userData.isCenter`
    const center = this.root.children.find((b: any) => b.userData?.isCenter) || this.root.children[0];
    if (!center) return;
    center.rotation.y = (center.userData._baseRotY ?? 0) + t * 0.6;
    center.scale.setScalar((center.userData._baseScale ?? 1) * (1 + Math.sin(t * 3) * 0.08));
  }

  private cueGlowRing(t: number): void {
    this.root.children.forEach((b: any, i: number) => {
      const phase = t * 1.5 - i * 0.25;
      const intensity = Math.max(0, Math.sin(phase) ** 8);
      b.traverse((c: any) => {
        if (c.isMesh && c.material?.emissive && c.userData._baseEmissive !== undefined) {
          c.material.emissiveIntensity = c.userData._baseEmissive + intensity * 1.5;
        }
      });
    });
  }

  private cueBounce(t: number): void {
    this.root.children.forEach((b: any, i: number) => {
      const baseY = b.userData._baseY ?? 0;
      const offset = Math.max(0, Math.sin(t * 3 - i * 0.4)) * 0.4;
      b.position.y = baseY + offset;
    });
  }

  private cueRotateRoot(t: number): void {
    this.root.rotation.y = (this.root.userData._baseRotY ?? 0) + Math.sin(t * 0.5) * 0.3;
  }

  private cueShake(t: number): void {
    const amp = Math.max(0, 0.3 - t * 0.15); // décroît en 2s
    this.root.children.forEach((b: any, i: number) => {
      const baseY = b.userData._baseY ?? 0;
      b.position.y = baseY + (Math.sin(t * 30 + i) * amp);
    });
  }

  private cueFadePulse(t: number): void {
    const op = 0.55 + Math.sin(t * 2.5) * 0.35;
    this.root.children.forEach((b: any) => {
      b.traverse((c: any) => {
        if (c.isMesh && c.material && c.userData._baseOpacity !== undefined) {
          c.material.transparent = true;
          c.material.opacity = op * c.userData._baseOpacity;
        }
      });
    });
  }
}
