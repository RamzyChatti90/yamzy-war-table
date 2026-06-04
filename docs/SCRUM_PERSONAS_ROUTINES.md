# 🌌 Routines des 7 Personas du Royaume

> **Le Yamzy World n'est pas un dashboard de plus — c'est un compagnon de quête.**
> Chaque membre d'une équipe Scrum y trouve sa routine, sa scénographie quotidienne,
> ses ateliers rituels. Le jeu sert la valeur. La narration sert la cadence.
>
> *Format : Identité (1 ligne) → Matin (10 min) → Journée (blocs typiques) →
> Soir (5 min) → Cadence hebdo → Ateliers Yamzy propres au rôle → Mantra Play+Value.*

---

## 1. 🌟 Le Mage Visionnaire — **Product Owner**

**Rôle réel** : porte la vision produit, prioritise le backlog, parle aux utilisateurs et au business.
**Mission** : « Décider QUOI on construit, et POURQUOI. »

### 🌅 Matin (10 min) — *Cercle de l'Étoile Polaire*
- Ouvre 🔭 **Telescope Island** : balaye le ciel des cérémonies d'hier (releases, incidents, sprint reviews remote). 30 sec → tu sais la météo du Royaume.
- Saute en portail → ⛰ **OKR Mountain** : vérifie le %ascension. Si un KR a chuté, identifie quelle quête le fait reculer.
- Termine en 🐠 **Oracle Aquarium** : lit les 3 dernières paroles de poissons (user feedback overnight). Note 1 pain point récurrent.

### ☀️ Journée — blocs typiques
- **Bloc Backlog (90 min)** sur 🏝 **Kanban Island** : reorder la plage (Backlog), promouvoir 3 bouteilles en graines (refined), confirme DoR.
- **Bloc Recherche (60 min)** dans 🐠 **Oracle Aquarium** : lance une `triggerEagleDive` sur un segment user, capture l'insight dans le coffre.
- **Bloc Roadmap (45 min)** dans 🔥 **Phoenix Forge** : aligne les Œufs (v1.5/v1.6/v2.0) avec les KRs de la Montagne.

### 🌙 Soir (5 min) — *Vœux à l'Aigle Royal*
- Telescope Island : si une cérémonie majeure a été émise aujourd'hui (release, incident), confirme qu'elle est visible dans le ciel pour tout le Royaume.

### 📅 Cadence hebdo
- **Lundi** : Sprint Planning → Cargo qui arrive sur Kanban (`arriveCargo`)
- **Mardi** : Backlog Refinement → Forêt du Cadrage
- **Mercredi** : User research sync → Aquarium
- **Jeudi** : Sprint Review prep → Sommet du Sanctuaire
- **Vendredi** : Stakeholder demo → 👁 Seigneur Veilleur invité en Telescope Island

### 🎯 Ateliers Yamzy propres au PO
- **🐠 Plongée Persona** *(bi-mensuel, 60 min)* — Avec UX, ouvre les coffres au trésor de l'Aquarium. Document 1 nouveau persona dans Library Cathedral.
- **⛰ Conseil des Sommets** *(mensuel, 30 min)* — Avec SM + Tech Lead, vérifie l'alignement KR → roadmap → backlog.
- **🌟 Conclave de Vision** *(trimestriel, 2h)* — Tous les stakeholders réunis à OKR Mountain pour planter les drapeaux du trimestre suivant.

### ✨ Mantra Play + Value
> *« Je joue à orienter le télescope du Royaume — et chaque pivot vers un signal devient une priorité backlog défendable. »*

---

## 2. 🌿 Le Berger des Compagnons — **Scrum Master**

**Rôle réel** : facilitateur de processus, supprime les impediments, protège l'équipe.
**Mission** : « Garder la cordée en route. »

### 🌅 Matin (10 min) — *Cercle de l'Aube*
- 🏝 **Kanban Island** : lance manuellement `dawnRitual()` 5 min avant le stand-up. La lumière dorée descend, tout le monde sait que c'est l'heure.
- Compte les voyageurs sur la falaise (blocked). Si > 2 → impediment de la journée identifié.

### ☀️ Journée
- **Stand-up (15 min)** sur Kanban Island : chaque dev raconte sa mule sur la pente.
- **Bloc Unblocking (variable)** : si un vautour tournoie sur falaise → SM intervient. Lance `vultureDive()` pour focus visuel.
- **Bloc Coaching (60 min)** : 1:1 avec un dev. Ouvre 🌌 **Star Map Risks** ensemble pour visualiser les périls perçus.

### 🌙 Soir
- Telescope Island : check si le ciel a vu des incidents (eclipse, solar storm). Si oui, prépare action item pour demain.

### 📅 Cadence hebdo
- **Lundi** : Sprint Planning facilitation
- **Tous les jours 10h** : Cercle de l'Aube (Daily) sur Kanban Island
- **Mercredi** : Mid-sprint check-in → `eagleSwoop` sur OKR Mountain
- **Vendredi** : Retrospective → 🔥 **Phoenix Forge / emberDrift** (les cendres tournoient = le passé éclairé)

### 🎯 Ateliers Yamzy propres au SM
- **🌌 Conclave des Périls** *(hebdomadaire, 30 min)* — Avec PO + Tech Lead à Star Map Risks. Allume une constellation par risque revu.
- **🪞 Hall des Vérités** *(bi-hebdo, 45 min)* — Code review process tuning à PR Mirror Hall. Identifier les patterns lents.
- **🔥 Renaissance Mensuelle** *(mensuel, 90 min)* — Atelier d'amélioration continue à Phoenix Forge. Ce qui doit mourir, ce qui doit renaître.

### ✨ Mantra Play + Value
> *« Je joue à protéger la cordée des tempêtes — et chaque cérémonie devient un rituel d'équipe ancré, pas une réunion forcée. »*

---

## 3. 🔨 Le Compagnon des Lignées — **Developer / Engineer**

**Rôle réel** : écrit le code, fait les tests, déploie, mentor entre pairs.
**Mission** : « Faire pousser des feuilles vertes sur l'Arbre. »

### 🌅 Matin (5 min) — *Salut au Tronc*
- 🌳 **Git Tree Room** : ouvre l'arbre. Repère sa branche (lignée verte → bleue → ambre selon couleur perso). Vérifie qu'elle n'a pas pris la mousse.

### ☀️ Journée
- **Bloc Code (focus mode)** : pas de room, juste l'IDE. Mais chaque commit émet une feuille → bus universel → ciel mis à jour pour tous.
- **Bloc Review (30 min)** dans 🪞 **PR Mirror Hall** : se positionne devant les miroirs collègues. `mirrorRipple` = nouvelle review demandée.
- **Bloc Deploy (variable)** dans 🔥 **Phoenix Forge** : observe l'Athanor brûler son commit, regarde le Phénix renaître si c'est un release day.

### 🌙 Soir (5 min) — *Plumes au sol*
- Phoenix Forge : compte les plumes accumulées au pied de l'athanor. Si > 30 → release imminente, prépare changelog.

### 📅 Cadence hebdo
- **Lundi** : pick ticket sur Kanban (montagne du build)
- **Mardi-Jeudi** : code + reviews
- **Vendredi** : release ritual ou stash & weekend → `mushroom` sur l'arbre

### 🎯 Ateliers Yamzy propres au Dev
- **🪞 Conclave des Miroirs** *(quotidien, 20 min)* — Self-organised : un dev call `chandelierFlash` quand un PR est critique. Les autres viennent dans Mirror Hall.
- **🌳 Élagage Saisonnier** *(mensuel, 30 min)* — Tous les devs ouvrent Git Tree, lancent `pruneStale()` collectivement, célèbrent la purification.
- **💎 Cérémonie des Cristaux** *(en cas de release)* — Tous se réunissent à Phoenix Forge pour regarder `crystalAuditPass()` — chaque test vert applaudi.

### ✨ Mantra Play + Value
> *« Je joue à voir mon nom briller sur les feuilles — et chaque commit devient un acte sacré, pas juste une ligne dans un graphe. »*

---

## 4. 🏗 Le Maître Architecte — **Tech Lead / Engineering Manager**

**Rôle réel** : décide stack, mentore les devs, gère la dette technique, communique avec stakeholders.
**Mission** : « Garder l'Arbre droit, et les Lignées saines. »

### 🌅 Matin (15 min)
- 🌳 Git Tree : audit visuel. Combien de branches mossy ? Combien de fruits draft pas mûris ?
- 🔥 Phoenix Forge : vérifie les Cristaux du dernier déploiement. Rouge ? → priorité du jour.

### ☀️ Journée
- **Bloc Architecture (90 min)** dans 🏛 **Library Cathedral** : écrit un ADR (Architecture Decision Record). `goldThreadWeave` quand il cross-référence un autre article.
- **Bloc Mentoring (60 min)** : 1:1 avec un dev. Co-visite Mirror Hall pour reviewer ensemble.
- **Bloc Risque (30 min)** dans 🌌 **Star Map Risks** : ajoute une nouvelle constellation pour une dette tech identifiée.

### 🌙 Soir
- Telescope Island : observe quelles cérémonies remote sont venues. Si Phoenix Forge a émis hotfix → quelle leçon en tirer ?

### 📅 Cadence hebdo
- **Lundi** : sprint planning tech
- **Mercredi** : Architecture review (Library Cathedral)
- **Vendredi** : Risk register update (Star Map)

### 🎯 Ateliers Yamzy propres au Tech Lead
- **🏛 Conclave des Tomes** *(hebdomadaire, 45 min)* — Avec 1-2 devs senior. Capitalise un savoir dans Library Cathedral. Un `bookFloat` par semaine = ADR ratifié.
- **🌌 Forge des Cieux** *(mensuel, 60 min)* — Risk review approfondi à Star Map. Pour chaque blackhole, plan de mitigation.
- **⚗ Conseil des Économies** *(trimestriel)* — Avec FinOps à Alchemist Cellar. Identifier les fioles qui consomment trop (cloud cost runaway).

### ✨ Mantra Play + Value
> *« Je joue à veiller sur la santé du Royaume — et chaque ADR capitalisé devient un savoir transmis, pas un PowerPoint perdu. »*

---

## 5. 🐠 Le Pêcheur d'Oracle — **UX Researcher / Designer**

**Rôle réel** : interviews utilisateurs, personas, prototypes, recherche de patterns.
**Mission** : « Écouter ce que les utilisateurs ne disent pas tout haut. »

### 🌅 Matin (10 min)
- 🐠 **Oracle Aquarium** : `schoolMigration` — voit-il l'arrivée d'une nouvelle cohorte de feedback ?
- Identifie les méduses (pain points) qui pulsent fortement → prio interview.

### ☀️ Journée
- **Bloc Interview (60 min)** : conduite réelle de user interviews. Après → `triggerEagleDive()` sur le poisson interviewé pour le marquer "extracted".
- **Bloc Synthèse (90 min)** : tagge les insights → `coralBloom` sur les feedbacks positifs, `jellyfishPulse` sur les pains.
- **Bloc Document (45 min)** dans 🏛 **Library Cathedral** : `newArticle` = persona ou JTBD doc.

### 🌙 Soir
- Oracle Aquarium : lance `revealTreasure` si un nouveau persona/insight a été distillé aujourd'hui.

### 📅 Cadence hebdo
- **Lundi-Mardi** : recherche terrain (interviews)
- **Mercredi** : synthèse + atelier discovery avec PO
- **Jeudi** : prototype design (outils externes : Figma, etc.)
- **Vendredi** : present findings à l'équipe → Library Cathedral `dawnLight`

### 🎯 Ateliers Yamzy propres au UX
- **🐠 Plongée Hebdomadaire** *(hebdo, 60 min)* — Avec PO. Ouvre coffres au trésor, valide les personas vivants.
- **💎 Atelier JTBD** *(bi-mensuel, 90 min)* — Distille les jobs-to-be-done depuis les coraux. Génère un sketch.
- **🌌 Constellation des Personas** *(trimestriel)* — Visualise dans Star Map ou Aquarium les groupes d'utilisateurs comme constellations.

### ✨ Mantra Play + Value
> *« Je joue à pêcher des vérités cachées — et chaque coffre ouvert devient un persona armé pour l'équipe, pas un fichier PDF poussiéreux. »*

---

## 6. 👁 Le Seigneur Veilleur — **Stakeholder / Exec Sponsor**

**Rôle réel** : valide budget, valide vision, intervient en crise. Pas dans les détails quotidiens.
**Mission** : « Voir si le Royaume va bien sans micro-gérer. »

### 🌅 Matin (3 min)
- 🔭 **Telescope Island** UNIQUEMENT. Une seule glance. La météo du ciel résume tout :
  - Aurore = sprint OK
  - Comet = release récente
  - Eclipse = incident
  - Étoiles calmes = rien à signaler

### ☀️ Journée
- Pas de routine. Sauf si Telescope alerte → ouvre la room source mentionnée.

### 🌙 Soir
- *(rien)*

### 📅 Cadence hebdo
- **Lundi 9h** : 3 min Telescope
- **Vendredi 17h** : 3 min Telescope + 1 portail vers OKR Mountain pour vérifier %ascension

### 🎯 Ateliers Yamzy propres au Stakeholder
- **🔭 Briefing Hebdo** *(15 min, vendredi)* — PO + SM + stakeholder à Telescope Island. Le ciel raconte la semaine en 3 phénomènes.
- **⛰ Sommet Trimestriel** *(trimestriel, 90 min)* — Visite OKR Mountain ensemble. Décision : nouveau drapeau, ou pivot ?
- **🌟 Conclave Annuel** *(annuel, 1/2 journée)* — Tour des 4 îles. Tous les hubs visités, état du Royaume entier.

### ✨ Mantra Play + Value
> *« Je joue à veiller depuis ma tour — et chaque ciel scanné en 3 min me donne plus de signal qu'un report de 50 pages. »*

---

## 7. ⚗ L'Apothicaire des Fioles — **FinOps Lead / CFO Tech**

**Rôle réel** : tracking budgets, cloud costs, ROI, lessons learned financières.
**Mission** : « Faire briller les cristaux d'économies. »

### 🌅 Matin (10 min)
- ⚗ **Alchemist Cellar** : vérifie les fioles. Couleur normale ? Aucune fiole rouge anomalie ?
- Owl screech overnight ? → priorité du jour.

### ☀️ Journée
- **Bloc Reconciliation (60 min)** : `athanorFire` quotidien. Process daily cloud cost, reconcile with budgets.
- **Bloc Optimization (90 min)** : identifie une fiole over-budget. Lance `distillRecommendationFlow` → reco vers Grimoire.
- **Bloc Insight (30 min)** : `crystallize` chaque économie identifiée. Cristal d'or = €1000 saved.

### 🌙 Soir
- Cellar : sourd un cristal nouveau ? Publié au bus = Telescope Island scintille (shooting star).

### 📅 Cadence hebdo
- **Lundi** : audit budgets
- **Mercredi** : optimization deep-dive
- **Vendredi** : Lessons learned → `grimoireOpen`

### 🎯 Ateliers Yamzy propres au FinOps
- **⚗ Distillation Hebdomadaire** *(hebdo, 45 min)* — Solo. Cristallise les insights du moment.
- **🌌 Conjuration des Économies** *(mensuel, 90 min)* — Avec Tech Lead. Lit le grimoire ensemble, applique 1-2 recos.
- **🏛 Consécration des Leçons** *(trimestriel, 60 min)* — Tag les top 5 lessons learned dans Library Cathedral. Forme la mémoire de l'organisation.

### ✨ Mantra Play + Value
> *« Je joue à transmuter les coûts en cristaux — et chaque économie devient une histoire racontable, pas une ligne Excel. »*

---

## 📊 Tableau récapitulatif — Persona × Rooms (intensité hebdo)

| Room | PO 🌟 | SM 🌿 | Dev 🔨 | TL 🏗 | UX 🐠 | Exec 👁 | Fin ⚗ |
|---|---|---|---|---|---|---|---|
| 🏝 Kanban | ★★★ | ★★★ | ★★ | ★ | – | – | – |
| 🌳 Git Tree | ★ | – | ★★★ | ★★★ | – | – | – |
| 🪞 PR Mirror | – | ★ | ★★★ | ★★ | – | – | – |
| 🔥 Phoenix | ★ | ★ | ★★ | ★★ | – | – | – |
| ⛰ OKR Mtn | ★★ | ★ | – | ★★ | – | ★ | – |
| 🌌 Star Map | ★ | ★★ | – | ★★ | ★ | – | – |
| 🔭 Telescope | ★ | ★ | – | ★ | – | ★★★ | ★ |
| 🏛 Library | ★ | – | ★ | ★★★ | ★★ | – | ★ |
| 🐠 Oracle | ★★ | – | – | – | ★★★ | – | – |
| ⚗ Alchemist | – | – | – | ★ | – | – | ★★★ |
| 🎴 Card Tavern | ★ | – | – | – | – | ★ | – |

*★★★ = quotidien, ★★ = hebdo, ★ = occasionnel*

---

## 🎉 Nouveaux ateliers proposés (cross-personas)

### 🌟 Conclave de Vision *(trimestriel, 2h)*
**Participants** : PO + Stakeholder + Tech Lead + UX
**Lieu** : OKR Mountain → Telescope Island → Library Cathedral
**Rituel** : (1) Plant the flag des KRs du trimestre suivant sur la montagne. (2) Telescope check des cérémonies passées du trimestre. (3) Archive les leçons dans Library.

### 🔥 Renaissance Trimestrielle *(trimestriel, 2h)*
**Participants** : toute l'équipe
**Lieu** : Phoenix Forge + Git Tree
**Rituel** : (1) `feathersConverge` rituel : toutes les plumes du trimestre s'aggrègent. (2) `triggerReleaseRitual` pour marquer le passage au nouveau trimestre. (3) Élagage saisonnier dans Git Tree : `pruneStale` collectif + `toggleSeason`.

### 🌌 Conclave des Périls *(hebdomadaire, 30 min)*
**Participants** : SM + PO + Tech Lead
**Lieu** : Star Map Risks
**Rituel** : revue collective. Pour chaque risque actif, décision : `constellationLight` (acknowledged), `triggerEclipseCinematic` (mitigated), `spawnComet` (escalated).

### 🐠 Voyage de la Tribu *(bi-mensuel, 90 min)*
**Participants** : PO + UX + 1-2 Devs
**Lieu** : Oracle Aquarium
**Rituel** : `schoolMigration` d'une cohorte précise → `jellyfishPulse` review pain points → décision : roadmap update ou pas.

### 🌀 Tour des Îles *(annuel, 1/2 journée)*
**Participants** : tous
**Lieu** : Yamzy Rooms Gallery → traversée des 4 island hubs via portails
**Rituel** : revisitation de tous les artefacts de l'année. Sur chaque île, narrateur Yamzy raconte les histoires clés. Finir au Sommet d'OKR Mountain avec drapeau de l'année plantée.

---

## 🌱 Onboarding — Premier jour d'un nouveau Compagnon

**Jour 1** :
1. 🏝 **Yamzy Island** — vue isométrique, comprendre la topologie
2. 🎓 Lance `How it works` sur Kanban Island — comprend le sprint flow
3. 🎓 Lance `How it works` sur Git Tree — comprend la mécanique commits
4. 🔭 Telescope Island — observe 3 min, comprend que c'est le radar

**Jour 2-5** :
- Joue les 3 scénarios (Demo principale + Crisis + Victory) de chaque room de SA boucle métier
- Lit le ROOM_PATTERN.md s'il code

**Semaine 2** :
- Premier Cercle de l'Aube en équipe
- Premier commit → feuille avec sa couleur sur l'Arbre

**Mois 1** :
- Persona consolidé : chaque routine ci-dessus devient son automatisme

---

## 🌟 Mantra global du Royaume

> *« Le travail n'est pas un to-do list. C'est une saga. Chaque ticket est un voyageur,
> chaque commit une feuille, chaque release une renaissance.
> Yamzy World ne remplace pas Scrum — il lui donne un corps poétique, et donc une mémoire. »*

---

*Doc maintenable : ajouter une nouvelle room → mettre à jour le tableau récapitulatif + ajouter un atelier si pertinent.*
