import { Routes } from '@angular/router';
import { authGuard } from './core/services/auth.guard';

// v1.0.127 — Renommage WAR TABLE -> Conclave de VESPER
// Route principale : /conclave (avec redirect compat depuis /war-table)
export const routes: Routes = [
  // 🎯 Default route → Yamzy Rooms Gallery (vitrine des scènes)
  { path: '', redirectTo: 'yamzy-rooms', pathMatch: 'full' },
  // Backward compat : ancien lien /war-table redirige vers /conclave
  { path: 'war-table', redirectTo: 'conclave', pathMatch: 'full' },
  // v1.0.122 — Page de login standalone (GitHub OAuth)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  // OAuth callback (recoit ?token=...)
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  // v1.0.127 — Studio (anciennement war-table) renomme Conclave de VESPER
  {
    path: 'conclave',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/war-table/war-table.component').then(m => m.WarTableComponent),
  },
  // Sanctuaire 3D : chambre + crystal du spell-caster (publique, sans auth)
  {
    path: 'conclave-room',
    loadComponent: () =>
      import('./features/conclave-room/conclave-room.component').then(m => m.ConclaveRoomComponent),
  },
  // Orrery Viewer — page indépendante fullscreen avec scène GLB + cristal + particules
  // (publique, demo / capture / partage — pas besoin d'auth ni de projet chargé)
  {
    path: 'orrery-viewer',
    loadComponent: () =>
      import('./features/orrery-viewer/orrery-viewer.component').then(m => m.OrreryViewerComponent),
  },
  // 🧪 ORRERY LAB — page d'isolation pour valider la mécanique 3D sans le GLB
  // Scène 100% THREE.js code : on valide ici puis on porte au GLB
  {
    path: 'orrery-lab',
    loadComponent: () =>
      import('./features/orrery-lab/orrery-lab.component').then(m => m.OrreryLabComponent),
  },
  // 🌳 GIT TREE ROOM — L'Arbre des Lignées
  { path: 'git-tree-room', loadComponent: () => import('./features/git-tree-room/git-tree-room.component').then(m => m.GitTreeRoomComponent) },
  // 🏝 KANBAN ISLAND — L'Archipel des Quêtes
  { path: 'kanban-island', loadComponent: () => import('./features/kanban-island-room/kanban-island-room.component').then(m => m.KanbanIslandRoomComponent) },
  // 🪞 PR MIRROR HALL — La Galerie des Vérités
  { path: 'pr-mirror-hall', loadComponent: () => import('./features/pr-mirror-hall-room/pr-mirror-hall-room.component').then(m => m.PrMirrorHallRoomComponent) },
  // 🔥 PHOENIX FORGE — L'Atelier des Renaissances
  { path: 'phoenix-forge', loadComponent: () => import('./features/phoenix-forge-room/phoenix-forge-room.component').then(m => m.PhoenixForgeRoomComponent) },
  // ⛰ OKR MOUNTAIN — L'Ascension du Sommet
  { path: 'okr-mountain', loadComponent: () => import('./features/okr-mountain-room/okr-mountain-room.component').then(m => m.OkrMountainRoomComponent) },
  // 🏛 LIBRARY CATHEDRAL — La Bibliothèque du Conclave
  { path: 'library-cathedral', loadComponent: () => import('./features/library-cathedral-room/library-cathedral-room.component').then(m => m.LibraryCathedralRoomComponent) },
  // 🌌 STAR MAP RISKS — La Carte Céleste des Périls
  { path: 'star-map-risks', loadComponent: () => import('./features/star-map-risks-room/star-map-risks-room.component').then(m => m.StarMapRisksRoomComponent) },
  // 🐠 ORACLE AQUARIUM — L'Étang des Voix
  { path: 'oracle-aquarium', loadComponent: () => import('./features/oracle-aquarium-room/oracle-aquarium-room.component').then(m => m.OracleAquariumRoomComponent) },
  // ⚗ ALCHEMIST CELLAR — La Cave aux Fioles
  { path: 'alchemist-cellar', loadComponent: () => import('./features/alchemist-cellar-room/alchemist-cellar-room.component').then(m => m.AlchemistCellarRoomComponent) },
  // 🎴 CARD TAVERN — La Taverne aux Cartes du Destin
  { path: 'card-tavern', loadComponent: () => import('./features/card-tavern-room/card-tavern-room.component').then(m => m.CardTavernRoomComponent) },
  // 🏝 YAMZY ISLAND — Hub central (vue isométrique de toutes les rooms)
  { path: 'yamzy-island', loadComponent: () => import('./features/yamzy-island-hub/yamzy-island-hub.component').then(m => m.YamzyIslandHubComponent) },
  // 🏗 YAMZY STUDIO MAKER — Application complète pour créer et éditer les rooms
  //   3D editor + library + inspector + GLB import/export + tutorial JSON form-builder
  { path: 'yamzy-studio-maker', loadComponent: () => import('./features/yamzy-studio-maker/yamzy-studio-maker.component').then(m => m.YamzyStudioMakerComponent) },
  // 🏝 YAMZY ROOMS GALLERY — Vitrine cards des rooms (design Studio Maker)
  { path: 'yamzy-rooms', loadComponent: () => import('./features/yamzy-rooms-gallery/yamzy-rooms-gallery.component').then(m => m.YamzyRoomsGalleryComponent) },
  // 🔭 TELESCOPE ISLAND — Observatoire des Phénomènes (ciel dynamique reflétant tous les événements projet)
  { path: 'telescope-island', loadComponent: () => import('./features/telescope-island-room/telescope-island-room.component').then(m => m.TelescopeIslandRoomComponent) },
  // 🏝 SHOWCASE — Visite publique guidée d'un projet (banner + role tour selector + read-only)
  { path: 'showcase/:projectKey', loadComponent: () => import('./features/yamzy-showcase/yamzy-showcase.component').then(m => m.YamzyShowcaseComponent) },
  // 🌍 WELCOME — Splash + tour vocal du Royaume (Yamzy le Conteur, voice-driven)
  { path: 'welcome', loadComponent: () => import('./features/yamzy-world-entry/yamzy-world-entry.component').then(m => m.YamzyWorldEntryComponent) },
  // 💧 MANA FOUNTAIN — Sensibilisation eau magique / tokens IA / coût $
  { path: 'mana-fountain', loadComponent: () => import('./features/mana-fountain-room/mana-fountain-room.component').then(m => m.ManaFountainRoomComponent) },
  // ⛵ RETROSPECTIVE COVE — Sprint retro Sailboat (vent / ancres / récifs / île)
  { path: 'retrospective-cove', loadComponent: () => import('./features/retrospective-cove-room/retrospective-cove-room.component').then(m => m.RetrospectiveCoveRoomComponent) },
  // ⚰ PRE-MORTEM CRYPT — Workshop imaginant les scénarios d'échec (Gary Klein method)
  { path: 'premortem-crypt', loadComponent: () => import('./features/premortem-crypt-room/premortem-crypt-room.component').then(m => m.PremortemCryptRoomComponent) },
  // 🏔 STORY TRAIL — Story Mapping (Jeff Patton) — sentiers user journey + pierres user stories + ligne MVP
  { path: 'story-trail', loadComponent: () => import('./features/story-trail-room/story-trail-room.component').then(m => m.StoryTrailRoomComponent) },
  // ☕ LEAN COFFEE — La Brûlerie Lean (agenda démocratique : tasses-sujets dans 4 zones)
  { path: 'lean-coffee', loadComponent: () => import('./features/lean-coffee-room/lean-coffee-room.component').then(m => m.LeanCoffeeRoomComponent) },
  // 🍇 REFINEMENT ORCHARD — Le Verger des Affinages (backlog grooming : fruits sur arbres)
  { path: 'refinement-orchard', loadComponent: () => import('./features/refinement-orchard-room/refinement-orchard-room.component').then(m => m.RefinementOrchardRoomComponent) },
  // 🪨 FIVE WHYS WELL — Root cause Toyota : descendre 5 niveaux pour atteindre la racine
  { path: 'five-whys-well', loadComponent: () => import('./features/five-whys-well-room/five-whys-well-room.component').then(m => m.FiveWhysWellRoomComponent) },
  // 🏖 DEFINITIONS BEACH — DoR/DoD : drapeaux Ready/Done plantés dans le sable + liens
  { path: 'definitions-beach', loadComponent: () => import('./features/definitions-beach-room/definitions-beach-room.component').then(m => m.DefinitionsBeachRoomComponent) },
  // 🌿 ÎLE LIVRAISON — Hub avec 4 rooms du flux delivery + 3 portails
  { path: 'island/delivery', loadComponent: () => import('./features/island-hub/delivery-island-hub.component').then(m => m.DeliveryIslandHubComponent) },
  // 🌌 ÎLE STRATÉGIE — Hub avec 3 rooms strategy + 3 portails
  { path: 'island/strategy', loadComponent: () => import('./features/island-hub/strategy-island-hub.component').then(m => m.StrategyIslandHubComponent) },
  // 🏛 ÎLE SAVOIR — Hub avec 2 rooms knowledge + 3 portails
  { path: 'island/knowledge', loadComponent: () => import('./features/island-hub/knowledge-island-hub.component').then(m => m.KnowledgeIslandHubComponent) },
  // ⚗ ÎLE COMMERCE — Hub avec 2 rooms commerce + 3 portails
  { path: 'island/commerce', loadComponent: () => import('./features/island-hub/commerce-island-hub.component').then(m => m.CommerceIslandHubComponent) },
  { path: '**', redirectTo: 'conclave' },
];
