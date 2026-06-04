// ═══════════════════════════════════════════════════════════════════
// 🪄 SPELL TOKENS — Design tokens partagés (ADN spell-caster)
//
// Une SOURCE DE VÉRITÉ unique pour fonts, couleurs, animations.
// Tout composant Spell-UI tire de ces tokens — homogénéité garantie.
// ═══════════════════════════════════════════════════════════════════
export const SPELL_TOKENS = {
  fonts: {
    heading: '"Henny Penny", cursive',
    body: '"Tinos", serif',
    googleImport: 'https://fonts.googleapis.com/css2?family=Henny+Penny&family=Tinos:wght@400;700&display=swap',
  },
  colors: {
    crystalPink: '#d54adf',
    crystalCyan: '#67e8f9',
    crystalAmber: '#f59e0b',
    crystalLime: '#84cc16',
    crystalSlate: '#475569',
    crystalSand: '#fde68a',
    crystalCoffee: '#6b4423',
    crystalBordeaux: '#831843',
    bg: 'rgba(0, 0, 0, 0.88)',
    text: '#f9f9f9',
    textMuted: '#a7a7a7',
    border: '#3e3e3e',
    secondary: '#767474',
  },
  z: {
    base: 1,
    overlay: 9000,
    splash: 9500,
    tutorial: 9600,
    toast: 9700,
  },
  anim: {
    fade: '0.6s ease-out',
    snap: '0.18s ease',
    glow: '0.8s ease-out forwards',
  },
} as const;

/** Couleur accent par défaut (magenta crystal du welcome) */
export const SPELL_DEFAULT_ACCENT = SPELL_TOKENS.colors.crystalPink;

/**
 * Type d'accent — toutes les rooms peuvent fournir leur propre couleur
 * (registre IslandRegistry / RoomRegistry ci-dessous)
 */
export type SpellAccent = string; // CSS color string
