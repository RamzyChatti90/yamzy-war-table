// ═══════════════════════════════════════════════════════════════════
// 📐 SPELL RESIZE HELPER — Three.js renderer + camera auto-resize
//
// Branche un listener sur window.resize qui :
//   - met à jour renderer.setSize(w, h)
//   - met à jour camera.aspect + projection matrix
//   - optionnel : appelle un callback custom (re-layout HUD, etc.)
//
// Retourne une fonction dispose() à appeler dans ngOnDestroy.
// ═══════════════════════════════════════════════════════════════════

export interface ResizeTargets {
  renderer: any;            // THREE.WebGLRenderer
  camera: any;              // THREE.PerspectiveCamera (avec .aspect)
  /** Élément qui définit la taille (default = window) */
  container?: HTMLElement;
  /** Hook appelé après resize (re-position HUD, etc.) */
  onResize?: (w: number, h: number) => void;
}

/**
 * Attache un resize listener et retourne le dispose().
 * Appelle aussi un fit initial pour caler la taille au mount.
 */
export function attachThreeResize(t: ResizeTargets): () => void {
  const handler = () => {
    const w = t.container ? t.container.clientWidth : window.innerWidth;
    const h = t.container ? t.container.clientHeight : window.innerHeight;
    if (w <= 0 || h <= 0) return;
    try { t.renderer.setSize(w, h, false); } catch {}
    if (t.camera) {
      t.camera.aspect = w / h;
      try { t.camera.updateProjectionMatrix(); } catch {}
    }
    t.onResize?.(w, h);
  };
  window.addEventListener('resize', handler);
  // Fit initial
  handler();
  return () => window.removeEventListener('resize', handler);
}
