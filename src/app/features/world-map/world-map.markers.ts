// ════════════════════════════════════════════════════════════════════════
// 🗺 WORLD MAP — Config partagée des 7 marqueurs de zones
//
// Cette liste est la SEULE source de vérité utilisée par :
//   • world-map.component.ts        (affichage drapeaux + lecture positions)
//   • world-map-zone-editor.component.ts  (éditeur 3D par zone)
//
// 🎨 RÉFÉRENCEMENT BLENDER
// ──────────────────────────────────────────────────────────────────────────
// Dans treasure-island.glb, ajouter 7 EMPTIES (ou meshes invisibles) nommés
// EXACTEMENT comme `blenderName` ci-dessous. Le code les détecte et place
// chaque drapeau à la position du Empty correspondant.
// Si un Empty est absent, fallback sur (defaultNx, defaultNz) — coords
// normalisées dans la bbox de Plane_2 (-1..+1).
//
// 🏝 GLB PAR ZONE
// ──────────────────────────────────────────────────────────────────────────
// Chaque zone aura son propre GLB d'île (`islandGlb`) que tu pourras éditer
// via /world-map/edit/{key} : import GLB → translate/scale/rotate → save.
// Le fichier sauvegardé doit être déposé à l'emplacement `islandGlb`.
// ════════════════════════════════════════════════════════════════════════

export interface MapMarker {
  /** Slug stable (route param + storage key) */
  key: string;
  /** Label affiché */
  label: string;
  /** Couleur du drapeau (hex 0xRRGGBB) */
  color: number;
  /** Route vers laquelle on navigue au clic */
  route: string;
  /** Nom EXACT de l'Empty/mesh dans treasure-island.glb */
  blenderName: string;
  /** Fallback position normalisée X dans bbox Plane_2 (-1..+1) */
  defaultNx: number;
  /** Fallback position normalisée Z dans bbox Plane_2 (-1..+1) */
  defaultNz: number;
  /** Chemin du GLB d'île de cette zone (peut être absent → drapeau seul) */
  islandGlb: string;
  /** Description courte (pour l'éditeur) */
  description: string;
  /** Si true → ignore le marker Empty, garde la position+scale natifs du GLB,
   *  ajoute comme enfant de treasure-island (hérite auto-fit + centrage). */
  useNativePos?: boolean;
}

export const MAP_MARKERS: ReadonlyArray<MapMarker> = [
  {
    key: 'yamzy',
    label: 'YAMZY',
    color: 0xd54adf,
    route: '/yamzy-island',
    blenderName: 'marker_yamzy',
    defaultNx: 0.0,
    defaultNz: 0.0,
    islandGlb: '/assets/conclave/models/island-yamzy.glb',
    description: "Île centrale — hub principal Yamzy World",
  },
  {
    key: 'strategy',
    label: 'STRATEGY',
    color: 0xc4b5fd,
    route: '/island/strategy',
    blenderName: 'marker_strategy',
    defaultNx: -0.55,
    defaultNz: -0.65,
    islandGlb: '/assets/conclave/models/island-strategy.glb',
    description: "Île Stratégie — vision, OKR, story mapping",
  },
  {
    key: 'knowledge',
    label: 'KNOWLEDGE',
    color: 0x06b6d4,
    route: '/island/knowledge',
    blenderName: 'marker_knowledge',
    defaultNx: 0.55,
    defaultNz: -0.65,
    islandGlb: '/assets/conclave/models/island-knowledge.glb',
    description: "Île Savoir — bibliothèque, rétros, lessons learned",
  },
  {
    key: 'delivery',
    label: 'DELIVERY',
    color: 0x86efac,
    route: '/island/delivery',
    blenderName: 'marker_delivery',
    defaultNx: -0.75,
    defaultNz: 0.0,
    islandGlb: '/assets/conclave/models/island-delivery.glb',
    description: "Île Livraison — kanban, PR mirror, phoenix forge",
  },
  {
    key: 'commerce',
    label: 'COMMERCE',
    color: 0xfbbf24,
    route: '/island/commerce',
    blenderName: 'marker_commerce',
    defaultNx: 0.75,
    defaultNz: 0.0,
    islandGlb: '/assets/conclave/models/island-commerce.glb',
    description: "Île Commerce — économie magique, marché",
  },
  {
    key: 'workshops',
    label: 'WORKSHOPS',
    color: 0x10b981,
    route: '/yamzy-rooms',
    blenderName: 'marker_workshops',
    defaultNx: -0.40,
    defaultNz: 0.65,
    islandGlb: '/assets/conclave/models/island-workshops.glb',
    description: "Île Workshops — galeries de salles Scrum",
  },
  {
    key: 'studios',
    label: 'STUDIOS',
    color: 0xb87333,
    route: '/yamzy-studio-maker',
    blenderName: 'marker_studios',
    defaultNx: 0.40,
    defaultNz: 0.65,
    islandGlb: '/assets/conclave/models/island-studios.glb',
    description: "Île Studios — Yamzy Studio Maker, création de salles",
  },
  {
    key: 'boat',
    label: 'BOAT',
    color: 0x1e40af,            // bleu marine / sea-blue
    route: '/yamzy-island',     // placeholder — adapte si tu fais une scène dédiée
    blenderName: 'marker_boat', // ignoré car useNativePos=true
    defaultNx: 0.0,
    defaultNz: 0.85,
    islandGlb: '/assets/conclave/models/island-boat.glb',
    description: "Navire — point d'embarquement / port",
    useNativePos: true,         // ⚡ scale + position déjà ajustés dans Blender → respecte tels quels
  },
];

/** Lookup par key (utilisé par l'éditeur via :zoneKey) */
export function getMarker(key: string): MapMarker | undefined {
  return MAP_MARKERS.find(m => m.key === key);
}

/** localStorage namespace pour la transform sauvegardée par zone */
export const STORAGE_KEY_PREFIX = 'yamzy.world-map.zone.';
