# 🏝 L'Île Publique — Vitrine du Mage

> **Ton île n'est pas un dashboard. C'est ton portfolio vivant.**
> Quand un ami clique sur ton lien, il atterrit sur ton île, Yamzy l'accueille,
> et lui raconte tes projets comme des sagas. L'état de tes îles et arbres
> reflète en temps réel l'état de tes repos git, sprints, releases.
> Pas de README. Pas de slides. **Un monde qui parle.**

---

## 🌐 Structure d'URL

```
/u/:username                       → Profil public d'un Mage (île d'accueil)
/u/:username/projects              → Vitrine de tous ses projets publics
/u/:username/p/:projectSlug        → Visite guidée d'un projet
/showcase/:projectKey              → Lien direct anonyme (partageable)
/showcase/:projectKey?tour=tech    → Tour avec persona Tech Lead
/showcase/:projectKey?tour=vision  → Tour avec persona PO
/showcase/:projectKey?tour=lore    → Tour Yamzy poétique pur
/showcase/:projectKey?guest=anon   → Mode anonyme (pas de tracking)
```

**Exemples** :
- `yamzy.world/u/ramzychatti90` → Île publique de Ramzy
- `yamzy.world/u/ramzychatti90/p/yamzy-world` → Visite guidée du projet meta
- `yamzy.world/showcase/yamzy-world` → Lien partageable Twitter/LinkedIn

---

## 🎭 Le moment "Un ami visite ton île"

### Étape 1 — Aterrissage
Le visiteur clique. La page charge en ~2s. Il voit :
- 🏝 L'**île 3D du Mage** — son portfolio isométrique
- 🪶 **Yamzy en avatar 3D GLB** apparaît bottom-left (avec une bulle)
- Le banner top : **"👋 Tu visites l'île de RamzyChatti90 — 11 projets, 142 fruits récoltés"**
- En haut-droit : `[Suivre]` `[Forker]` `[Partager]` `[Mode anonyme]`

### Étape 2 — Tour automatique
Yamzy déroule un **tour cinématique de 90 secondes** :
1. *« Bienvenue, voyageur. Ici tu es chez RamzyChatti90, un Mage Stratège qui forge depuis 2024. »*
2. *« Devant toi son Arbre des Lignées — yamzy-world. 247 feuilles vertes, 12 fruits dorés en prod, et un champignon rouge qui garde une ébauche secrète… »*
3. *« Suis-moi vers l'Atelier des Renaissances. La forge brille — un déploiement a eu lieu il y a 2 heures. »*
4. *« La Montagne des Sommets : Ramzy y a planté 4 drapeaux dorés ce trimestre. Ses Compagnons sont au 73% d'ascension. »*
5. *« Tu peux maintenant explorer librement — clique sur n'importe quel bâtiment. Tu ne peux rien modifier, mais tu peux tout voir. »*

### Étape 3 — Exploration libre (visit mode)
- Tous les boutons d'**édition** sont remplacés par des **icônes 👁** (read-only)
- Tous les portails fonctionnent normalement
- Le narrator reste disponible : ouvrir `🎓 How it works` ou `▶ Play example` du projet présenté
- Possibilité de **laisser un message dans le livre d'or** (single line)

### Étape 4 — Conversion (call-to-action)
Après 3 minutes de visite, Yamzy revient :
- *« Tu sembles intéressé. Tu veux créer TA propre île ? C'est gratuit. »*
- Bouton `Créer mon île` → onboarding

---

## 🌳 Mapping État Projet ↔ État Île (live)

L'idée : **TON ÎLE EST UN MIROIR VIVANT** de tes repos git et projets actifs.

### 🌳 Git Tree Room reflète l'état git
| État repo | Effet visuel sur l'arbre |
|---|---|
| Repo actif (commits récents) | Feuilles vert vif, lucioles dansent |
| Repo dormant (>30j sans push) | Feuilles ternes, mousse sur branches |
| Releases (git tags) | Fruits dorés visibles depuis l'île |
| Releases pre-release | Fruits vert lime |
| Stashes ouverts | Champignons rouges au pied |
| Branches stale | Mousse foncée sur ces branches |
| WIP en cours (uncommitted) | Petites flammes sur la branche active |

### 🌍 État global de l'île ambiante
| État du portfolio | Effet sur l'île entière |
|---|---|
| Beaucoup de stashes éparpillés (>20) | **Champignons partout** sur toute l'île 🍄 |
| Sprint récemment terminé avec succès | **Aurora boréale** au-dessus de l'île |
| Incident actif en prod | **Tempête solaire** rouge au-dessus |
| Release majeure dans les 48h passées | **Traînée de comète** résiduelle |
| Aucune activité depuis 7 jours | **Brume légère**, étoiles ternies |
| Vélocité team excellente | **Lucioles abondantes** + feu de camp |
| Backlog overflow | **Plage couverte de bouteilles** débordantes |
| Compagnons en harmonie (cordée serrée) | **Sentier illuminé** sur la montagne |
| Risques critiques actifs | **Trou noir visible** dans le ciel |
| Conjonction d'événements + KRs au plus haut | **Sommet doré** + drapeaux flottent intensément |

### 🔭 Telescope Island = la grande horloge
Sur l'île publique, Telescope est **toujours actif en arrière-plan** :
- Ses derniers 7 jours d'événements rejouent en accéléré dans le ciel
- Le visiteur voit instantanément "la semaine" du Mage

---

## 🎭 Tours multi-personas (4 voix)

Le même projet peut être présenté **selon 4 angles**. L'URL `?tour=X` switch :

### `?tour=vision` — Le Mage Visionnaire (PO voice)
*« Ramzy a forgé ce projet pour résoudre un problème : voir un sprint board comme une saga, pas une grille. Les 142 utilisateurs actifs valident l'intuition. La roadmap vise 1000 d'ici Q2. »*
**Focus** : pourquoi, qui, vers où.

### `?tour=tech` — Le Maître Architecte (Tech Lead voice)
*« Stack : Angular 17 standalone + Three.js r128 + Spring Boot + Postgres. 6 services, 18k SLOC, ~80% test coverage. Architecture : monolithe progressif vers microservices, dette tech contrôlée. »*
**Focus** : stack, qualité, scalabilité.

### `?tour=lore` — Yamzy poétique pure
*« Cette île dort sous les étoiles depuis 247 jours. Chaque feuille raconte un effort, chaque fruit une renaissance. Le Mage qui forge ici parle peu mais ses Compagnons chantent en silence. »*
**Focus** : émotion, narration.

### `?tour=metrics` — L'Apothicaire des Fioles (FinOps voice)
*« Coût mensuel cloud : €87. Revenu : €0 (open-source). Lessons learned distillées : 23. Cristaux dorés cumulés : €4 500 d'économies optimisations. »*
**Focus** : chiffres, ROI, optimisations.

---

## 👥 Personas variantes pour l'accueil

Quand un visiteur arrive, **Yamzy peut prendre la voix d'un autre persona** selon le contexte :

- **Visiteur recruteur tech** → Tech Lead (Maître Architecte) guide
- **Visiteur investisseur** → PO + FinOps duo
- **Visiteur potentiel teammate** → Scrum Master parle de la culture d'équipe
- **Visiteur fan / friend** → Yamzy lore pur, narration émotionnelle

L'utilisateur (propriétaire de l'île) **scripte le tour** dans Studio Maker → exporte un `showcase.tutorial.json`.

---

## 🌟 Vitrine du portfolio (multi-projets)

Sur `/u/:username` (l'île d'accueil) :
- **Tous les projets** sont des arbres distincts sur la même île géante
- **Le plus brillant** (le projet "épinglé") est au centre
- Les autres en cercles concentriques
- Chaque arbre = clic → ouvre son propre showcase
- En arrière-plan : **météo aggregate** des projets (si 3/5 ont une aurora active → l'île entière a l'aurora)

---

## 🤝 Fonctionnalités sociales (roadmap)

### Phase Social-1 — Identité publique
- [ ] Profil Mage : avatar, bio, lien GitHub, île URL custom
- [ ] Projets publics/privés (toggle par projet)
- [ ] Livre d'or (commentaires visiteurs)

### Phase Social-2 — Connexions
- [ ] Suivre un Mage (notifications de cérémonies majeures)
- [ ] Forker un projet (clone son tutorial JSON + structure)
- [ ] Co-visite (deux Mages dans la même île simultanément, leurs avatars 3D visibles)

### Phase Social-3 — Compétitions sociales
- [ ] Classement annuel : Mage de l'année par catégorie (productivité, originalité, lore)
- [ ] **Foires aux Îles** : événement où les nouveaux Mages exposent leur île aux anciens
- [ ] Badges : "100 commits", "Release majeure", "OKR 100%", "1 an d'usage continu"

---

## 🔧 Implementation phases

### Phase 1 — Prototype (cette semaine)
- ✅ Design doc (ce fichier)
- ✅ Sample showcase tutorial JSON (`showcase-yamzy-world.tutorial.json`)
- 🚧 Route `/showcase/:projectKey` qui charge Git Tree avec banner visit mode
- 🚧 Auto-launch du tour à l'arrivée
- 🚧 Banner top "👋 Tu visites l'île de X" + boutons sociaux

### Phase 2 — Vitrine multi-projets (~2 semaines)
- 🚧 Nouvelle route `/u/:username` avec scène 3D montrant N arbres
- 🚧 Drag & drop position des projets dans Studio Maker
- 🚧 Météo aggregate calculée à partir des projets

### Phase 3 — Backend (~1 mois)
- 🚧 API `/api/users/:username/projects` (état git, derniers commits, etc.)
- 🚧 Sync periodique : repo state → island state
- 🚧 Cache + WebSocket pour live updates pendant la visite

### Phase 4 — Social (~1 mois)
- 🚧 Authentification multi-user (GitHub OAuth existant suffit)
- 🚧 Follows / livre d'or / forks
- 🚧 Notifications cross-îles (ex: "Ton ami a sorti une release v2.0")

---

## 🚀 Quick start — Tester le concept dès maintenant

### Pour expérimenter le tour `showcase` :

1. Le fichier `src/assets/tutorials/showcase-yamzy-world.tutorial.json` contient un tour pré-écrit
2. Navigate manuellement vers `/git-tree-room` avec ce JSON chargé comme tutorial
3. Le tour parle de "RamzyChatti90 / yamzy-world" comme si tu visitais l'île d'un ami

### Pour générer ton propre tour de visite :

1. Va dans **Studio Maker**
2. Section "📜 Tutorial" → crée un nouveau tutorial avec :
   - roomKey : `showcase`
   - meta : ton projet (nom, vision, état)
   - tour : 5-7 steps qui décrivent le projet
   - playExample : une démo de 60s qui raconte la saga complète
3. Exporte → tu obtiens ton lien partageable `/showcase/:tonProjet`

---

## 🌟 Mantra de la Vitrine Publique

> *« Mon île parle pour moi. Quand un ami clique, ce ne sont pas des screenshots
> figés — c'est mon arbre vivant, mes drapeaux trimestriels, mes cendres
> d'expériences. Mon portfolio est un monde. Et chaque visiteur en repart
> avec une histoire. »*

---

## 📊 Métriques de succès du concept

Pour valider l'idée :
- **Visiteur moyen reste** : > 90 secondes (vs 15s pour un README GitHub)
- **Taux de clic CTA "Créer mon île"** : > 5%
- **Partages organiques** : un Mage propriétaire partage son île 2-3× / mois
- **Time-to-comprendre** : un visiteur comprend le projet en < 2 min (vs lire un README de 800 lignes)

---

*Concept ouvert à évolution. Le bus universel (CeremonyBusService) + les 11 rooms +
les portails sont DÉJÀ l'infrastructure technique nécessaire — il reste à exposer
publiquement et scripter la narration.*
