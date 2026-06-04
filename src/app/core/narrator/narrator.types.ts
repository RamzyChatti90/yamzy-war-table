// ═══════════════════════════════════════════════════════════════════
// 🪶 NARRATOR TYPES — Schéma du fichier *.tutorial.json
//
// Chaque room a un fichier `assets/tutorials/{room-key}.tutorial.json`
// qui décrit la visite (How it works) + la démo animée (Play example).
//
// Le NarratorService lit ce JSON et orchestre :
//   • Mouvement de caméra avec interpolation cubique
//   • Highlight des objets 3D (scale boost + outline)
//   • Bulles de narration façon YAMZY companion
//   • Sync narration ↔ caméra ↔ état de la scène
//
// Pour ajouter un nouveau studio :
//   1. Créer `assets/tutorials/{name}.tutorial.json` (suivre _template.tutorial.json)
//   2. Tagger les objets 3D avec mesh.userData.tutorialId
//   3. C'est tout — le bouton 🎓 How it works marche automatiquement
// ═══════════════════════════════════════════════════════════════════

/** Mode du narrateur — Yamzy = lore gaming, Scrum = vocabulaire dev officiel */
export type NarratorMode = 'yamzy' | 'scrum';

/** Position 3D ou interpolation depuis position actuelle */
export type Vec3 = [number, number, number];

/** Une entrée glossaire = 1 type d'objet 3D explicable */
export interface TutorialGlossaryEntry {
  /** Identifiant unique posé en mesh.userData.tutorialId (kebab-case) */
  tutorialId: string;
  /** Nom Yamzy lore (ex: "Le Cœur de Cristal") */
  name: string;
  /** Nom alternatif (ex: "Le Ruby Central") — optionnel */
  loreName?: string;
  /** Terme Scrum officiel (ex: "Burndown chart") */
  scrumName: string;
  /** Description courte (1 phrase, mode mixte) */
  desc: string;
  /** Explication mode Yamzy (lore complet, 2-4 phrases, style mage stratège) */
  yamzyExplain: string;
  /** Explication mode Scrum (dev terminology, 2-4 phrases) */
  scrumExplain: string;
  /** Interactions possibles sur cet objet (ex: ["click = explode", "drag = rotate"]) */
  interactions?: string[];
}

/** Une étape de tour narratif */
export interface TutorialTourStep {
  /** Numéro d'étape (pour navigation) */
  step: number;
  /** Mode du narrateur pour cette étape (legacy — si yamzyText+scrumText fournis, ignoré au profit du dual-flow) */
  narratorMode?: NarratorMode;  // default: yamzy
  /** Texte affiché dans la bulle (legacy single-message). Préfère yamzyText+scrumText pour le dual-flow. */
  text?: string;
  /** Texte Yamzy lore (style mage stratège). Si fourni avec scrumText, déclenche le dual-message avec morph magique. */
  yamzyText?: string;
  /** Texte Scrum dev / chef de projet (terminologie agile). Joué après yamzyText avec animation de transformation. */
  scrumText?: string;
  /** Mots-clés à highlighter pendant le morph (transformation visible des termes). Ex: ["Plage de l'Aurore→Backlog", "Voyageur→Ticket"] */
  morphPairs?: Array<{ yamzy: string; scrum: string }>;
  /** Mouvement de caméra (interpolé cubic-easing) */
  camera?: {
    position?: Vec3;
    lookAt?: Vec3;
    /** Durée du mouvement en secondes (default 2.0) */
    duration?: number;
  };
  /** Objet à highlighter (cherche dans la scene par tutorialId) — scale boost + outline */
  highlight?: string;
  /** Émettre une cérémonie (déclenche le flash overlay) */
  emitCeremony?: { type: string; label: string; icon: string };
  /** Appeler une méthode de la room (par nom) — ex: 'loadDemo', 'toggleWeather' */
  invokeMethod?: { name: string; args?: any[] };
  /** Temps d'attente avant auto-next (secondes) — 0 = manuel via bouton Next */
  wait?: number;
}

/** Une étape de la démo animée (Play example) */
export interface TutorialExampleStep {
  /** Quand déclencher cette étape (secondes depuis début) */
  atSeconds: number;
  /** Texte narrateur synchronisé (legacy single-message). Préfère yamzyText+scrumText pour le dual-flow. */
  narratorText?: string;
  /** Texte Yamzy lore (joué en 1er, ~50% du segment). */
  yamzyText?: string;
  /** Texte Scrum / chef de projet (joué après yamzyText avec morph magique). */
  scrumText?: string;
  /** Mots-clés à highlighter pendant la transformation (ex: "Plage→Backlog"). */
  morphPairs?: Array<{ yamzy: string; scrum: string }>;
  /** Méthode de la room à invoquer */
  invokeMethod?: { name: string; args?: any[] };
  /** Mouvement caméra */
  camera?: { position?: Vec3; lookAt?: Vec3; duration?: number };
  /** Highlight d'un objet */
  highlight?: string;
  /** Cérémonie à émettre */
  emitCeremony?: { type: string; label: string; icon: string };
}

/** La démo animée complète (Play example) */
export interface TutorialPlayExample {
  /** Nom court de cette démo (ex: "Crisis", "Victory"). Optionnel pour la principale. */
  name?: string;
  /** Icone optionnel à afficher devant le nom dans la liste (ex: "🚨", "🏆") */
  icon?: string;
  /** Durée totale en secondes */
  duration: number;
  /** Description courte (1 phrase) — affichée au bouton */
  description: string;
  /** Mode du narrateur (default: yamzy) */
  narratorMode?: NarratorMode;
  /** Étapes séquencées sur la timeline */
  steps: TutorialExampleStep[];
}

/** Le fichier tutorial complet pour 1 room */
export interface RoomTutorial {
  /** Identifiant de la room (= route name) */
  roomKey: string;
  /** Métadonnées affichées dans la bulle */
  meta: {
    name: string;
    loreName?: string;
    icon: string;
    color: string;
    /** Description courte de la room */
    summary: string;
    /** Lore introduction (3-4 phrases) */
    introLore: string;
  };
  /** Liste des objets 3D explicables */
  glossary: TutorialGlossaryEntry[];
  /** Tour pas-à-pas (How it works) */
  tour: TutorialTourStep[];
  /** Démo animée principale (Play example) */
  playExample: TutorialPlayExample;
  /** Démos additionnelles (scénarios alternatifs : crise, victoire, etc.).
   *  Affichées dans le menu "▶ More demos" du narrator. */
  additionalDemos?: TutorialPlayExample[];
  /** Yamzy lore signature à la fin du tour (optional) */
  closingMessage?: string;
}

/** Bridge entre la room et le NarratorService */
export interface NarratorRoomBridge {
  /** La caméra Three.js de la room */
  camera: any;
  /** OrbitControls (pour disable pendant les anim) */
  controls?: any;
  /** La scene Three.js */
  scene: any;
  /** Le clock (pour delta time) */
  clock: any;
  /** Référence au composant room pour invokeMethod */
  roomComponent: any;
  /** Clé identifiant la room (charge le bon JSON) */
  roomKey: string;
}
