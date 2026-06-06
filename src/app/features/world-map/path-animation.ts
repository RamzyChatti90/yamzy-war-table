// ════════════════════════════════════════════════════════════════════════
// 🎬 PATH ANIMATION — Anime un mesh le long de waypoints (Empties Blender)
//
// 🎨 CONVENTION BLENDER
// ──────────────────────────────────────────────────────────────────────────
// Ajoute des Empties nommés `anim_<id>_<n>` dans ton GLB :
//   • anim_mouette_0, anim_mouette_1, anim_mouette_2, ...   ← path "mouette"
//   • anim_ship_0, anim_ship_1, ...                          ← path "ship"
//   • anim_cloud_0, anim_cloud_1, ...                        ← path "cloud"
//
// Le code :
//   1. Scanne le GLB → groupe les Empties par <id>, triés par <n>
//   2. Si un MESH nommé `<id>` (ou commençant par `<id>`) existe dans le GLB,
//      il est animé automatiquement le long du path
//   3. Sinon tu peux attacher manuellement un objet au path via PathAnimator
//
// 🔧 EXEMPLE Blender → GLB :
//   Mesh `mouette` (le modèle 3D)
//   Empty `anim_mouette_0` à (-5, 3, 0)       ← début de la traj
//   Empty `anim_mouette_1` à ( 0, 5, 2)
//   Empty `anim_mouette_2` à ( 5, 3, 0)       ← fin de la traj
//   → la mouette vole de 0 → 1 → 2 en boucle (durée par défaut 5s, modifiable)
//
// 🔁 MODES DE BOUCLE
//   • 'repeat'    → 0→1→2→0→1→2…  (saut à la fin)
//   • 'pingpong'  → 0→1→2→1→0→1…  (aller-retour fluide)
//   • 'once'      → 0→1→2 puis stop
// ════════════════════════════════════════════════════════════════════════

/** Pattern de match pour les Empties de waypoint. */
export const ANIM_KEYFRAME_PATTERN = /^anim_([a-z0-9_-]+)_(\d+)$/i;

export interface AnimKeyframe {
  index: number;
  pos: [number, number, number];
  rot: [number, number, number];
  scl: [number, number, number];
}

export interface AnimPath {
  id: string;
  keyframes: AnimKeyframe[];
}

/** Scanne `scene` et regroupe les Empties `anim_<id>_<n>` en paths par id. */
export function extractAnimationPaths(scene: any, T: any): Map<string, AnimPath> {
  const groups = new Map<string, AnimKeyframe[]>();
  scene.traverse((obj: any) => {
    if (!obj.name) return;
    const m = obj.name.match(ANIM_KEYFRAME_PATTERN);
    if (!m) return;
    const id = m[1];
    const index = parseInt(m[2], 10);
    obj.updateWorldMatrix(true, false);
    const worldPos = new T.Vector3();
    obj.getWorldPosition(worldPos);
    const kf: AnimKeyframe = {
      index,
      pos: [worldPos.x, worldPos.y, worldPos.z],
      rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scl: [obj.scale.x, obj.scale.y, obj.scale.z],
    };
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(kf);
  });
  const paths = new Map<string, AnimPath>();
  for (const [id, kfs] of groups) {
    kfs.sort((a, b) => a.index - b.index);
    paths.set(id, { id, keyframes: kfs });
    console.log(`[PathAnim] ✓ path "${id}" → ${kfs.length} waypoints`);
  }
  return paths;
}

export type LoopMode = 'repeat' | 'pingpong' | 'once';

/**
 * Anime un objet le long d'un AnimPath (interpolation linéaire entre waypoints).
 * Appelle `.update(elapsed)` chaque frame avec le temps écoulé total en secondes.
 */
export class PathAnimator {
  constructor(
    public readonly obj: any,
    public readonly path: AnimPath,
    public durationSec: number = 5,
    public loop: LoopMode = 'repeat',
    /** Si true → fait pointer l'objet dans la direction du mouvement (utile pour mouette/oiseau). */
    public faceForward: boolean = false,
  ) {}

  /** Met à jour la position/rotation/scale de obj selon le temps écoulé. */
  update(elapsedSec: number): void {
    const kfs = this.path.keyframes;
    if (!kfs.length) return;
    if (kfs.length === 1) {
      const kf = kfs[0];
      this.obj.position.set(kf.pos[0], kf.pos[1], kf.pos[2]);
      this.obj.rotation.set(kf.rot[0], kf.rot[1], kf.rot[2]);
      this.obj.scale.set(kf.scl[0], kf.scl[1], kf.scl[2]);
      return;
    }

    // Calcul de t ∈ [0, 1] selon le mode de boucle
    const raw = elapsedSec / this.durationSec;
    let t: number;
    switch (this.loop) {
      case 'pingpong': {
        const full = raw % 2;
        t = full < 1 ? full : 2 - full;
        break;
      }
      case 'once':
        t = Math.max(0, Math.min(1, raw));
        break;
      case 'repeat':
      default:
        t = raw - Math.floor(raw);
        break;
    }

    // Trouve le segment [i, i+1] dans la liste des keyframes
    const n = kfs.length - 1;
    const segT = t * n;
    const i = Math.min(Math.floor(segT), n - 1);
    const u = segT - i;
    const a = kfs[i];
    const b = kfs[i + 1];

    // Interpolation linéaire pos/rot/scale
    this.obj.position.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * u,
      a.pos[1] + (b.pos[1] - a.pos[1]) * u,
      a.pos[2] + (b.pos[2] - a.pos[2]) * u,
    );

    if (this.faceForward) {
      // Vecteur direction = b - a (en horizontal pour ne pas que l'oiseau pique)
      const dx = b.pos[0] - a.pos[0];
      const dz = b.pos[2] - a.pos[2];
      if (dx * dx + dz * dz > 1e-6) {
        this.obj.rotation.y = Math.atan2(dx, dz);
      }
    } else {
      this.obj.rotation.set(
        a.rot[0] + (b.rot[0] - a.rot[0]) * u,
        a.rot[1] + (b.rot[1] - a.rot[1]) * u,
        a.rot[2] + (b.rot[2] - a.rot[2]) * u,
      );
    }

    this.obj.scale.set(
      a.scl[0] + (b.scl[0] - a.scl[0]) * u,
      a.scl[1] + (b.scl[1] - a.scl[1]) * u,
      a.scl[2] + (b.scl[2] - a.scl[2]) * u,
    );
  }
}

/**
 * Auto-attache un PathAnimator à chaque mesh du `scene` dont le nom correspond
 * à un id de path (ou commence par `<id>_`). Renvoie la liste des animators
 * créés — l'appelant doit les `update()` chaque frame.
 *
 * Exemple : path "mouette" + mesh "mouette" → animator créé automatiquement.
 */
export function autoAttachPathAnimators(
  scene: any,
  paths: Map<string, AnimPath>,
  options: { durationSec?: number; loop?: LoopMode; faceForward?: boolean } = {},
): PathAnimator[] {
  const animators: PathAnimator[] = [];
  for (const [id, path] of paths) {
    let mesh: any = null;
    scene.traverse((obj: any) => {
      if (mesh || !obj.name) return;
      // match exact OU mesh nommé `<id>_<...>` (skin/groupes Blender)
      if (obj.name === id || obj.name.startsWith(id + '_') || obj.name.startsWith(id + '.')) {
        // Évite de prendre un Empty `anim_<id>_<n>` comme mesh à animer
        if (ANIM_KEYFRAME_PATTERN.test(obj.name)) return;
        mesh = obj;
      }
    });
    if (mesh) {
      animators.push(new PathAnimator(
        mesh, path,
        options.durationSec ?? 5,
        options.loop ?? 'repeat',
        options.faceForward ?? false,
      ));
      console.log(`[PathAnim] ✓ animator auto-créé pour mesh "${mesh.name}" sur path "${id}"`);
    } else {
      console.log(`[PathAnim] · path "${id}" sans mesh associé — attache un objet à la main via new PathAnimator(...)`);
    }
  }
  return animators;
}
