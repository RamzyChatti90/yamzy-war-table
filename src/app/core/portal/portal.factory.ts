// ═══════════════════════════════════════════════════════════════════
// 🌀 PORTAL FACTORY — Génère un portail 3D pour naviguer entre les îles
//
// Usage dans une room :
//   import { createPortal3D, PortalHandle } from '../../core/portal/portal.factory';
//   const T = (window as any).THREE;
//   this.portal = createPortal3D(T, this.scene, {
//     position: [x, y, z],
//     targetRoute: '/island/delivery',
//     islandLabel: 'Île de la Livraison',
//     color: 0x86efac,
//     scale: 1.0,
//   });
//   // Dans animate(): this.portal.tick(dt);
//   // Dans handleCanvasClick(): const target = this.portal.hitTest(this.raycaster); if (target) router.navigate([target]);
// ═══════════════════════════════════════════════════════════════════

export interface PortalConfig {
  /** Position du portail dans la scène */
  position: [number, number, number];
  /** Rotation Y du portail (face caméra par défaut) */
  rotationY?: number;
  /** Route vers laquelle naviguer au click */
  targetRoute: string;
  /** Label de l'île destination (affiché en hover/tooltip) */
  islandLabel: string;
  /** Couleur principale du portail (emissive + particules) */
  color: number;
  /** Scale uniforme (1.0 par défaut) */
  scale?: number;
  /** Émettre une lumière dans la scène ? (default true) */
  withLight?: boolean;
}

export interface PortalHandle {
  /** Groupe Three.js racine du portail */
  group: any;
  /** Mesh du ring (torus) pour raycaster */
  ringMesh: any;
  /** Mesh du plane intérieur (shimmer) */
  shimmerMesh: any;
  /** Light émise (si withLight=true) */
  light: any | null;
  /** Cible de navigation */
  targetRoute: string;
  /** Label hover */
  islandLabel: string;
  /** Couleur primaire */
  color: number;
  /** Update animation (à appeler dans la loop animate()) */
  tick: (dt: number, elapsed: number) => void;
  /** Test si le raycaster touche le portail. Retourne le targetRoute si oui, null sinon. */
  hitTest: (raycaster: any) => string | null;
  /** Cleanup (à appeler dans ngOnDestroy) */
  dispose: () => void;
}

/**
 * Crée un portail 3D animé dans la scène.
 * Le portail est un torus glowy + plane shimmer + particules + light optionnelle.
 */
export function createPortal3D(T: any, scene: any, cfg: PortalConfig): PortalHandle {
  const scale = cfg.scale ?? 1.0;
  const group = new T.Group();
  group.position.set(...cfg.position);
  if (cfg.rotationY !== undefined) group.rotation.y = cfg.rotationY;
  group.scale.setScalar(scale);
  group.userData.tutorialId = 'portal';
  group.userData.targetRoute = cfg.targetRoute;
  group.userData.islandLabel = cfg.islandLabel;
  group.userData.kind = 'portal-group';

  // ─── Ring extérieur : torus émissif ───
  const ringGeom = new T.TorusGeometry(1.6, 0.18, 16, 48);
  const ringMat = new T.MeshStandardMaterial({
    color: cfg.color,
    emissive: cfg.color,
    emissiveIntensity: 1.3,
    metalness: 0.7,
    roughness: 0.25,
  });
  const ring = new T.Mesh(ringGeom, ringMat);
  ring.userData.kind = 'portal-ring';
  ring.userData.targetRoute = cfg.targetRoute;
  group.add(ring);

  // ─── Plane shimmer intérieur : disque qui ondule en alpha ───
  const shimmerGeom = new T.CircleGeometry(1.45, 48);
  const shimmerMat = new T.MeshBasicMaterial({
    color: cfg.color,
    transparent: true,
    opacity: 0.55,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const shimmer = new T.Mesh(shimmerGeom, shimmerMat);
  shimmer.userData.kind = 'portal-shimmer';
  shimmer.userData.targetRoute = cfg.targetRoute;
  group.add(shimmer);

  // ─── Second ring interne (épais et pulsant) ───
  const innerRingGeom = new T.TorusGeometry(1.1, 0.05, 12, 32);
  const innerRingMat = new T.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    blending: T.AdditiveBlending,
  });
  const innerRing = new T.Mesh(innerRingGeom, innerRingMat);
  innerRing.userData.kind = 'portal-inner-ring';
  group.add(innerRing);

  // ─── Particules orbitant autour du ring ───
  const particleCount = 48;
  const positions = new Float32Array(particleCount * 3);
  const angles = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const a = (i / particleCount) * Math.PI * 2;
    angles[i] = a + Math.random() * 0.5;
    positions[i * 3 + 0] = Math.cos(a) * 1.6;
    positions[i * 3 + 1] = Math.sin(a) * 1.6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
  }
  const partGeom = new T.BufferGeometry();
  partGeom.setAttribute('position', new T.BufferAttribute(positions, 3));
  const partMat = new T.PointsMaterial({
    color: cfg.color,
    size: 0.18,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new T.Points(partGeom, partMat);
  particles.userData.angles = angles;
  particles.userData.kind = 'portal-particles';
  group.add(particles);

  // ─── PointLight optionnelle ───
  let light: any | null = null;
  if (cfg.withLight !== false) {
    light = new T.PointLight(cfg.color, 1.4, 10, 1.6);
    light.position.set(0, 0, 0.3);
    group.add(light);
  }

  // ─── Label flottant : utilise un sprite text (simple plane texturé) ───
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512; labelCanvas.height = 96;
  const ctx = labelCanvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(20,15,40,0.85)';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#' + cfg.color.toString(16).padStart(6, '0');
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 500, 84);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌀 ' + cfg.islandLabel, 256, 48);
  const labelTex = new T.CanvasTexture(labelCanvas);
  labelTex.needsUpdate = true;
  const labelMat = new T.SpriteMaterial({ map: labelTex, transparent: true });
  const labelSprite = new T.Sprite(labelMat);
  labelSprite.position.set(0, 2.2, 0);
  labelSprite.scale.set(3.0, 0.55, 1);
  labelSprite.userData.kind = 'portal-label';
  group.add(labelSprite);

  scene.add(group);

  // ═══════════════════════════════════════════════════════════════════
  // TICK : animation continue
  // ═══════════════════════════════════════════════════════════════════
  const tick = (dt: number, elapsed: number) => {
    // Ring extérieur : rotation Z lente + pulse emissive
    ring.rotation.z += dt * 0.4;
    ring.material.emissiveIntensity = 1.0 + Math.sin(elapsed * 2.5) * 0.5;
    // Ring interne : rotation Z rapide en sens inverse + scale pulse
    innerRing.rotation.z -= dt * 1.4;
    const innerScale = 1 + Math.sin(elapsed * 4) * 0.12;
    innerRing.scale.set(innerScale, innerScale, 1);
    innerRing.material.opacity = 0.75 + Math.sin(elapsed * 3.5) * 0.2;
    // Shimmer : alpha modulation + slight rotation
    shimmer.material.opacity = 0.45 + Math.sin(elapsed * 1.8) * 0.18;
    shimmer.rotation.z += dt * 0.25;
    // Particules : orbitent
    const pos = particles.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    const angs = particles.userData.angles as Float32Array;
    for (let i = 0; i < particleCount; i++) {
      angs[i] += dt * 0.6;
      arr[i * 3 + 0] = Math.cos(angs[i]) * 1.6;
      arr[i * 3 + 1] = Math.sin(angs[i]) * 1.6;
      arr[i * 3 + 2] = Math.sin(elapsed * 2 + i * 0.3) * 0.3;
    }
    pos.needsUpdate = true;
    // Light : pulse intensity
    if (light) {
      light.intensity = 1.2 + Math.sin(elapsed * 3) * 0.6;
    }
    // Label : bobbing léger
    labelSprite.position.y = 2.2 + Math.sin(elapsed * 1.5) * 0.08;
  };

  // ═══════════════════════════════════════════════════════════════════
  // HIT-TEST : raycaster
  // ═══════════════════════════════════════════════════════════════════
  const hitTest = (raycaster: any): string | null => {
    // Tester ring + shimmer (ils sont assez gros pour être faciles à cliquer)
    const hits = raycaster.intersectObjects([ring, shimmer, innerRing], false);
    if (hits.length > 0) return cfg.targetRoute;
    return null;
  };

  // ═══════════════════════════════════════════════════════════════════
  // DISPOSE
  // ═══════════════════════════════════════════════════════════════════
  const dispose = () => {
    scene.remove(group);
    ringGeom.dispose(); ringMat.dispose();
    shimmerGeom.dispose(); shimmerMat.dispose();
    innerRingGeom.dispose(); innerRingMat.dispose();
    partGeom.dispose(); partMat.dispose();
    labelTex.dispose(); labelMat.dispose();
  };

  return {
    group, ringMesh: ring, shimmerMesh: shimmer, light,
    targetRoute: cfg.targetRoute, islandLabel: cfg.islandLabel, color: cfg.color,
    tick, hitTest, dispose,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ISLAND METADATA — Source de vérité pour les 4 îles thématiques
// ═══════════════════════════════════════════════════════════════════
export interface IslandDef {
  id: 'delivery' | 'strategy' | 'knowledge' | 'commerce';
  name: string;
  loreName: string;
  icon: string;
  color: number;       // pour portals + meshes 3D
  cssColor: string;    // pour CSS/HTML
  description: string;
  route: string;
  roomRoutes: Array<{ route: string; name: string; icon: string }>;
}

export const ISLANDS: IslandDef[] = [
  {
    id: 'delivery',
    name: 'Île de la Livraison',
    loreName: 'L\'Archipel des Œuvres',
    icon: '🌿',
    color: 0x86efac,
    cssColor: '#86efac',
    description: 'Le flux quotidien — du commit jusqu\'à la prod. Code → Review → Sprint → Release.',
    route: '/island/delivery',
    roomRoutes: [
      { route: '/git-tree-room', name: 'Git Tree', icon: '🌳' },
      { route: '/pr-mirror-hall', name: 'PR Mirror Hall', icon: '🪞' },
      { route: '/kanban-island', name: 'Kanban Island', icon: '🏝' },
      { route: '/phoenix-forge', name: 'Phoenix Forge', icon: '🔥' },
    ],
  },
  {
    id: 'strategy',
    name: 'Île de la Stratégie',
    loreName: 'Le Royaume Stellaire',
    icon: '🌌',
    color: 0xa855f7,
    cssColor: '#a855f7',
    description: 'La vue d\'avion — objectives, risques, signaux. La boucle directionnelle du Mage Stratège.',
    route: '/island/strategy',
    roomRoutes: [
      { route: '/okr-mountain', name: 'OKR Mountain', icon: '⛰' },
      { route: '/star-map-risks', name: 'Star Map Risks', icon: '🌌' },
      { route: '/telescope-island', name: 'Telescope Island', icon: '🔭' },
    ],
  },
  {
    id: 'knowledge',
    name: 'Île du Savoir',
    loreName: 'Le Sanctuaire des Voix',
    icon: '🏛',
    color: 0x06b6d4,
    cssColor: '#06b6d4',
    description: 'Capter et conserver la sagesse — docs, recherche utilisateurs, capitalisation.',
    route: '/island/knowledge',
    roomRoutes: [
      { route: '/library-cathedral', name: 'Library Cathedral', icon: '🏛' },
      { route: '/oracle-aquarium', name: 'Oracle Aquarium', icon: '🐠' },
    ],
  },
  {
    id: 'commerce',
    name: 'Île du Commerce',
    loreName: 'La Côte d\'Ambre',
    icon: '⚗',
    color: 0xfbbf24,
    cssColor: '#fbbf24',
    description: 'Le portefeuille — budgets, leads, deals. Ce qui rentre et ce qui sort du Royaume.',
    route: '/island/commerce',
    roomRoutes: [
      { route: '/alchemist-cellar', name: 'Alchemist Cellar', icon: '⚗' },
      { route: '/card-tavern', name: 'Card Tavern', icon: '🎴' },
    ],
  },
];

/** Retourne l'île à laquelle appartient une route de room donnée */
export function getIslandForRoom(route: string): IslandDef | null {
  for (const island of ISLANDS) {
    if (island.roomRoutes.some(r => r.route === route)) return island;
  }
  return null;
}

/** Retourne les 3 autres îles (pour les portails dans un island hub) */
export function getOtherIslands(islandId: IslandDef['id']): IslandDef[] {
  return ISLANDS.filter(i => i.id !== islandId);
}
