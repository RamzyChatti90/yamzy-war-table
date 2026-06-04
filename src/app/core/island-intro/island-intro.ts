// ═══════════════════════════════════════════════════════════════════
// 🎬 ISLAND INTRO — Caméra cinématique d'arrivée sur une île
//
// Anime la caméra d'une vue d'oiseau (loin + haut) vers la vue
// interactive standard de chaque île. OrbitControls désactivés pendant
// l'animation pour éviter conflit avec le damping/clamping.
//
// IMPORTANT : on n'appelle PAS controls.update() pendant l'anim car
// le damping/clamping du OrbitControls pollue la caméra. On settle
// position + lookAt en direct, et on rebranche les controls à la fin.
// ═══════════════════════════════════════════════════════════════════

export interface Vec3 { x: number; y: number; z: number; }

/**
 * Joue une intro cinématique : caméra démarre haut + loin,
 * et lerp vers (finalPos, finalTarget) avec easing.
 */
export function playIslandIntro(
  camera: any,
  controls: any | null,
  finalPos: Vec3,
  finalTarget: Vec3,
  durationS: number = 3.5,
): Promise<void> {
  // Vue d'oiseau de départ : 1.6× plus loin + 1.4× plus haut (modéré, sous maxDistance)
  const startPos: Vec3 = {
    x: finalPos.x * 1.6,
    y: finalPos.y * 1.4 + 10,
    z: finalPos.z * 1.6,
  };
  // Target légèrement au-dessus pour cadre la totalité de l'île
  const startTarget: Vec3 = {
    x: finalTarget.x,
    y: finalTarget.y + 2,
    z: finalTarget.z,
  };

  // 1) Désactive les controls AVANT de toucher la caméra
  //    (sinon le damping/clamping va lutter contre nous)
  if (controls) controls.enabled = false;

  // 2) Position initiale + orientation
  camera.position.set(startPos.x, startPos.y, startPos.z);
  camera.lookAt(startTarget.x, startTarget.y, startTarget.z);

  return new Promise(resolve => {
    const startTime = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    let done = false;

    const update = () => {
      if (done) return;
      const elapsed = (performance.now() - startTime) / 1000;
      const t = Math.min(1, elapsed / durationS);
      const k = ease(t);

      // Lerp position + lookAt (BYPASS OrbitControls totalement)
      camera.position.set(
        startPos.x + (finalPos.x - startPos.x) * k,
        startPos.y + (finalPos.y - startPos.y) * k,
        startPos.z + (finalPos.z - startPos.z) * k,
      );
      const tx = startTarget.x + (finalTarget.x - startTarget.x) * k;
      const ty = startTarget.y + (finalTarget.y - startTarget.y) * k;
      const tz = startTarget.z + (finalTarget.z - startTarget.z) * k;
      camera.lookAt(tx, ty, tz);

      if (t < 1) {
        requestAnimationFrame(update);
      } else {
        done = true;
        // Rebranche les controls maintenant que la caméra est à sa position finale
        if (controls) {
          controls.target.set(finalTarget.x, finalTarget.y, finalTarget.z);
          controls.enabled = true;
          // Manually call update() ONCE pour synchroniser l'état spherical
          try { controls.update(); } catch {}
        }
        resolve();
      }
    };
    requestAnimationFrame(update);
  });
}
