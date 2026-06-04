// ═══════════════════════════════════════════════════════════════════
// 🌌 SKY ORNAMENTS — Factory partagée pour le ciel universel
//
// Tous les ciels du Royaume (Yamzy Island Hub, 4 sub-islands, Showcase,
// Telescope Island, etc.) doivent avoir le même langage visuel :
//   ─ Étoiles 500-800 (additive blend, no-fog, twinkle)
//   ─ Lune dorée avec halo + halo extérieur + light
//   ─ 3 couches d'aurore (verte, violette, cyan) ondulant
//   ─ Comète résiduelle drift slowly (release récente)
//   ─ Étoiles filantes périodiques
//
// Réagit aussi aux cérémonies du CeremonyBusService pour spawner des
// phénomènes éphémères (comet, supernova, aurora flash, etc.)
//
// Usage :
//   const sky = buildSkyOrnaments(T, scene, { starCount: 600 });
//   // dans animate : sky.tick(dt, elapsed)
//   // dans subscriber : sky.pulseCeremony('renaissance')
//   // dans dispose : sky.dispose()
// ═══════════════════════════════════════════════════════════════════

export interface SkyOptions {
  /** Nombre d'étoiles fixes (default 600) */
  starCount?: number;
  /** Rayon de la sphère étoilée (default 90) */
  starRadius?: number;
  /** Position 3D de la lune (default [-22, 16, -18]) */
  moonPos?: [number, number, number];
  /** Position 3D centrale de l'aurore (default [0, 24, -38]) */
  auroraPos?: [number, number, number];
  /** Position 3D initiale de la comète résiduelle (default [15, 18, -18]) */
  cometPos?: [number, number, number];
  /** Nombre d'étoiles filantes spawners actifs (default 5) */
  shootingStarCount?: number;
}

export interface SkyOrnamentsHandle {
  starsField: any;
  moon: any;
  aurora: any;
  cometTrail: any;
  shootingStars: any[];
  /** Activer/désactiver dynamiquement l'aurore (sprint actif/inactif) */
  setAuroraVisible(on: boolean): void;
  /** Animation : à appeler depuis chaque frame */
  tick(dt: number, elapsed: number): void;
  /** Réagit à une cérémonie cross-room (CeremonyBus) — spawn phénomène temporaire */
  pulseCeremony(ceremonyType: string): void;
  /** Cleanup (retire tout du scene + dispose materials/geoms) */
  dispose(): void;
}

/**
 * Construit le ciel ornemental universel dans la scène fournie.
 */
export function buildSkyOrnaments(T: any, scene: any, opts: SkyOptions = {}): SkyOrnamentsHandle {
  const starCount = opts.starCount ?? 600;
  const starRadius = opts.starRadius ?? 90;
  const moonPos = opts.moonPos ?? [-22, 16, -18];
  const auroraPos = opts.auroraPos ?? [0, 24, -38];
  const cometPos = opts.cometPos ?? [15, 18, -18];
  const shootingCount = opts.shootingStarCount ?? 5;

  // ─── États internes pour cleanup ───
  const addedObjects: any[] = [];
  const tickHelpers: Array<(dt: number, elapsed: number) => void> = [];
  let windTimeRef = 0;

  // ─── ⭐ STARSFIELD ───
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const phi = Math.acos(Math.random() * 0.95);
    const theta = Math.random() * Math.PI * 2;
    const r = starRadius + Math.random() * 18;
    starPositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi) + 10;
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const tint = Math.random();
    if (tint < 0.65) {
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 1.0; starColors[i * 3 + 2] = 1.0;
    } else if (tint < 0.88) {
      starColors[i * 3] = 0.78; starColors[i * 3 + 1] = 0.88; starColors[i * 3 + 2] = 1.0;
    } else {
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.9; starColors[i * 3 + 2] = 0.7;
    }
  }
  const starGeom = new T.BufferGeometry();
  starGeom.setAttribute('position', new T.BufferAttribute(starPositions, 3));
  starGeom.setAttribute('color', new T.BufferAttribute(starColors, 3));
  const starMat = new T.PointsMaterial({
    size: 1.8, sizeAttenuation: true, transparent: true, opacity: 1.0,
    blending: T.AdditiveBlending, vertexColors: true, fog: false,
  });
  const starsField = new T.Points(starGeom, starMat);
  scene.add(starsField);
  addedObjects.push(starsField);
  tickHelpers.push((_, elapsed) => {
    if (starMat) starMat.opacity = 0.85 + Math.sin(elapsed * 1.2) * 0.1;
  });

  // ─── 🌙 LUNE DORÉE + HALOS ───
  const moonMat = new T.MeshBasicMaterial({ color: 0xfff4a3, transparent: false, fog: false });
  const moon = new T.Mesh(new T.SphereGeometry(4.5, 32, 24), moonMat);
  moon.position.set(...moonPos);
  scene.add(moon);
  addedObjects.push(moon);

  const halo1 = new T.Mesh(
    new T.SphereGeometry(7, 24, 16),
    new T.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.35,
      blending: T.AdditiveBlending, fog: false, depthWrite: false,
    })
  );
  halo1.position.copy(moon.position);
  scene.add(halo1);
  addedObjects.push(halo1);

  const halo2 = new T.Mesh(
    new T.SphereGeometry(10, 20, 14),
    new T.MeshBasicMaterial({
      color: 0xfacc15, transparent: true, opacity: 0.15,
      blending: T.AdditiveBlending, fog: false, depthWrite: false,
    })
  );
  halo2.position.copy(moon.position);
  scene.add(halo2);
  addedObjects.push(halo2);

  const moonLight = new T.PointLight(0xfde047, 1.2, 80, 1.2);
  moonLight.position.copy(moon.position);
  scene.add(moonLight);
  addedObjects.push(moonLight);

  tickHelpers.push((dt, elapsed) => {
    moon.rotation.y += dt * 0.05;
    if (halo1.material) {
      halo1.material.opacity = 0.32 + Math.sin(elapsed * 0.7) * 0.10;
      const s = 1 + Math.sin(elapsed * 0.5) * 0.05;
      halo1.scale.setScalar(s);
    }
    if (halo2.material) {
      halo2.material.opacity = 0.13 + Math.sin(elapsed * 0.5 + 0.5) * 0.06;
    }
  });

  // ─── 🌌 AURORE BORÉALE (3 couches) ───
  const auroraGeom = new T.PlaneGeometry(80, 28, 24, 6);
  const buildAuroraLayer = (color: number, opacity: number, yOffset: number, zOffset: number) => {
    const mat = new T.MeshBasicMaterial({
      color, transparent: true, opacity,
      blending: T.AdditiveBlending, side: T.DoubleSide,
      depthWrite: false, fog: false,
    });
    const layer = new T.Mesh(auroraGeom.clone(), mat);
    layer.position.set(auroraPos[0], auroraPos[1] + yOffset, auroraPos[2] + zOffset);
    layer.userData.basePositions = (() => {
      const arr = new Float32Array(layer.geometry.attributes.position.array.length);
      arr.set(layer.geometry.attributes.position.array);
      return arr;
    })();
    scene.add(layer);
    addedObjects.push(layer);
    return layer;
  };
  const auroraGreen = buildAuroraLayer(0x6ee7b7, 0.7, 0, 0);
  const auroraViolet = buildAuroraLayer(0xc084fc, 0.55, 4, -4);
  const auroraCyan = buildAuroraLayer(0x67e8f9, 0.45, 8, -8);
  let auroraVisible = true;

  tickHelpers.push((_, elapsed) => {
    if (!auroraVisible) return;
    const layers = [auroraGreen, auroraViolet, auroraCyan];
    for (const layer of layers) {
      const geom = layer.geometry;
      const pos = geom.attributes.position;
      const arr = pos.array as Float32Array;
      const base = layer.userData.basePositions as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i];
        arr[i + 1] = base[i + 1] + Math.sin(elapsed * 0.6 + x * 0.18) * 1.6;
        arr[i + 2] = base[i + 2] + Math.cos(elapsed * 0.45 + x * 0.12) * 1.0;
      }
      pos.needsUpdate = true;
      if (layer.material) {
        const baseOp = layer === auroraGreen ? 0.55 : layer === auroraViolet ? 0.40 : 0.30;
        layer.material.opacity = baseOp + Math.sin(elapsed * 0.5) * 0.10;
      }
    }
  });

  // ─── ☄ COMÈTE RÉSIDUELLE ───
  const cometGroup = new T.Group();
  cometGroup.add(new T.Mesh(
    new T.SphereGeometry(0.9, 12, 8),
    new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, fog: false })
  ));
  cometGroup.add(new T.Mesh(
    new T.SphereGeometry(1.6, 16, 10),
    new T.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.4,
      blending: T.AdditiveBlending, fog: false, depthWrite: false,
    })
  ));
  const tailCount = 60;
  const tailPos = new Float32Array(tailCount * 3);
  const tailCol = new Float32Array(tailCount * 3);
  for (let i = 0; i < tailCount; i++) {
    tailPos[i * 3 + 0] = -i * 0.55;
    tailPos[i * 3 + 1] = -i * 0.08;
    tailPos[i * 3 + 2] = 0;
    const fade = 1 - i / tailCount;
    tailCol[i * 3 + 0] = 1.0 * fade;
    tailCol[i * 3 + 1] = 0.85 * fade;
    tailCol[i * 3 + 2] = 0.5 * fade;
  }
  const tailGeom = new T.BufferGeometry();
  tailGeom.setAttribute('position', new T.BufferAttribute(tailPos, 3));
  tailGeom.setAttribute('color', new T.BufferAttribute(tailCol, 3));
  const tailMat = new T.PointsMaterial({
    size: 1.0, vertexColors: true, transparent: true, opacity: 0.9,
    blending: T.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  cometGroup.add(new T.Points(tailGeom, tailMat));
  cometGroup.position.set(...cometPos);
  cometGroup.rotation.z = -0.35;
  scene.add(cometGroup);
  addedObjects.push(cometGroup);
  const cometStartPos = [...cometPos] as [number, number, number];

  tickHelpers.push((dt, elapsed) => {
    cometGroup.position.x += dt * 0.4;
    cometGroup.position.y -= dt * 0.08;
    if (cometGroup.position.x > 60) {
      cometGroup.position.set(...cometStartPos);
    }
    const head = cometGroup.children[0];
    if (head?.material) head.material.opacity = 0.7 + Math.sin(elapsed * 1.5) * 0.2;
  });

  // ─── 🌠 ÉTOILES FILANTES ───
  const shootingStars: any[] = [];
  for (let s = 0; s < shootingCount; s++) {
    const shootGeom = new T.BufferGeometry();
    const shootPos = new Float32Array(15 * 3);
    const shootCol = new Float32Array(15 * 3);
    for (let i = 0; i < 15; i++) {
      shootPos[i * 3 + 0] = -i * 0.45;
      shootPos[i * 3 + 1] = -i * 0.18;
      shootPos[i * 3 + 2] = 0;
      const fade = 1 - i / 15;
      shootCol[i * 3 + 0] = 1.0 * fade;
      shootCol[i * 3 + 1] = 1.0 * fade;
      shootCol[i * 3 + 2] = 0.85 * fade;
    }
    shootGeom.setAttribute('position', new T.BufferAttribute(shootPos, 3));
    shootGeom.setAttribute('color', new T.BufferAttribute(shootCol, 3));
    const shootMat = new T.PointsMaterial({
      size: 0.8, vertexColors: true, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, sizeAttenuation: true, fog: false,
    });
    const shoot = new T.Points(shootGeom, shootMat);
    shoot.userData = {
      nextSpawnAt: s * 6 + (s * 17) % 4,  // déterministe (Math.random est bloqué dans workflows)
      active: false,
      progress: 0,
      startPos: { x: 0, y: 0, z: 0 },
      endPos: { x: 0, y: 0, z: 0 },
      ceremonialColor: null as null | [number, number, number],
    };
    scene.add(shoot);
    shootingStars.push(shoot);
    addedObjects.push(shoot);
  }

  // Updateur d'étoiles filantes (séparé pour pouvoir spawn on-demand via pulseCeremony)
  const spawnShootingStar = (shoot: any, elapsed: number, color?: [number, number, number]) => {
    shoot.userData.active = true;
    shoot.userData.progress = 0;
    // Spread déterministe basé sur elapsed pour varier
    const r1 = ((elapsed * 13) % 1);
    const r2 = ((elapsed * 17) % 1);
    const r3 = ((elapsed * 11) % 1);
    const sx = -40 + r1 * 80;
    const sy = 30 + r2 * 18;
    const sz = -50 + r3 * 30;
    shoot.userData.startPos = { x: sx, y: sy, z: sz };
    shoot.userData.endPos = {
      x: sx + 25 + ((elapsed * 7) % 15),
      y: sy - 18 - ((elapsed * 5) % 10),
      z: sz + 5 + ((elapsed * 3) % 8),
    };
    shoot.position.set(sx, sy, sz);
    const dx = shoot.userData.endPos.x - shoot.userData.startPos.x;
    const dy = shoot.userData.endPos.y - shoot.userData.startPos.y;
    shoot.rotation.z = Math.atan2(dy, dx);
    // Si couleur cérémonielle, teinte les points
    if (color) {
      const colorAttr = shoot.geometry.attributes.color;
      const arr = colorAttr.array as Float32Array;
      for (let i = 0; i < 15; i++) {
        const fade = 1 - i / 15;
        arr[i * 3 + 0] = color[0] * fade;
        arr[i * 3 + 1] = color[1] * fade;
        arr[i * 3 + 2] = color[2] * fade;
      }
      colorAttr.needsUpdate = true;
      shoot.userData.ceremonialColor = color;
    } else if (shoot.userData.ceremonialColor) {
      // Réinitialiser au blanc
      const colorAttr = shoot.geometry.attributes.color;
      const arr = colorAttr.array as Float32Array;
      for (let i = 0; i < 15; i++) {
        const fade = 1 - i / 15;
        arr[i * 3 + 0] = 1.0 * fade;
        arr[i * 3 + 1] = 1.0 * fade;
        arr[i * 3 + 2] = 0.85 * fade;
      }
      colorAttr.needsUpdate = true;
      shoot.userData.ceremonialColor = null;
    }
  };

  tickHelpers.push((dt, elapsed) => {
    for (const shoot of shootingStars) {
      const ud = shoot.userData;
      if (!ud.active && elapsed >= ud.nextSpawnAt) {
        spawnShootingStar(shoot, elapsed);
      }
      if (ud.active) {
        ud.progress += dt * 0.55;
        const t = Math.min(1, ud.progress);
        shoot.position.x = ud.startPos.x + (ud.endPos.x - ud.startPos.x) * t;
        shoot.position.y = ud.startPos.y + (ud.endPos.y - ud.startPos.y) * t;
        shoot.position.z = ud.startPos.z + (ud.endPos.z - ud.startPos.z) * t;
        const op = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1;
        if (shoot.material) shoot.material.opacity = Math.max(0, Math.min(1, op)) * 0.95;
        if (t >= 1) {
          ud.active = false;
          ud.nextSpawnAt = elapsed + 4 + ((elapsed * 7) % 6);
          if (shoot.material) shoot.material.opacity = 0;
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // HANDLE PUBLIC
  // ═══════════════════════════════════════════════════════════════════
  const handle: SkyOrnamentsHandle = {
    starsField,
    moon,
    aurora: auroraGreen, // first layer for external access
    cometTrail: cometGroup,
    shootingStars,

    setAuroraVisible(on: boolean): void {
      auroraVisible = on;
      auroraGreen.visible = on;
      auroraViolet.visible = on;
      auroraCyan.visible = on;
    },

    tick(dt: number, elapsed: number): void {
      windTimeRef = elapsed;
      for (const fn of tickHelpers) fn(dt, elapsed);
    },

    pulseCeremony(ceremonyType: string): void {
      // Map cérémonie → couleur RGB pour étoile filante + spawn immédiat
      let color: [number, number, number] = [1, 1, 0.85]; // default warm white
      switch (ceremonyType) {
        case 'renaissance':
        case 'release':
        case 'harvest':
        case 'comet':
          color = [1.0, 0.7, 0.4]; // orange comet
          break;
        case 'major-release':
        case 'supernova':
          color = [1.0, 0.5, 0.8]; // pink supernova
          break;
        case 'eclipse':
        case 'siren':
          color = [0.4, 0.1, 0.1]; // dark red
          break;
        case 'death':
        case 'rollback':
        case 'incident':
        case 'storm':
        case 'feu':
        case 'solar-storm':
          color = [1.0, 0.3, 0.1]; // hot red
          break;
        case 'debarquement':
        case 'fall':
        case 'pruning':
        case 'meteor':
          color = [0.8, 0.85, 1.0]; // bluish meteor
          break;
        case 'sommet':
        case 'flag':
        case 'aurora':
          color = [0.5, 1.0, 0.6]; // green sommet
          break;
        case 'aube':
        case 'dawn':
        case 'bloom':
        case 'nebula':
          color = [0.9, 0.6, 1.0]; // purple nebula
          break;
        case 'solstice':
        case 'crescent':
          color = [1.0, 0.9, 0.5]; // gold crescent
          break;
        case 'conjunction':
          color = [0.7, 1.0, 1.0]; // cyan conjunction
          break;
      }
      // Trouve un slot libre et spawn immédiatement
      const free = shootingStars.find(s => !s.userData.active);
      if (free) {
        spawnShootingStar(free, windTimeRef, color);
      }
    },

    dispose(): void {
      for (const obj of addedObjects) {
        scene.remove(obj);
        if (obj.geometry?.dispose) obj.geometry.dispose();
        if (obj.material?.dispose) obj.material.dispose();
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) m.dispose();
        }
      }
      tickHelpers.length = 0;
      addedObjects.length = 0;
    },
  };

  return handle;
}
