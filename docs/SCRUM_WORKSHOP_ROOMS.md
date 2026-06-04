# 🌊 Le Royaume vit grâce à la Magie — qui consomme de l'Eau

> *« Chaque sort lancé dans le Royaume puise dans une source : l'eau du Conclave.
> Cette eau, c'est celle qui refroidit les datacenters où vit la magie de l'IA.
> Chaque goutte coûte des tokens, des centimes, et des millilitres physiques.
> Voir la goutte tomber, c'est se souvenir qu'aucune magie n'est gratuite. »*

---

## 💧 L'Économie de l'Eau Magique

### Le principe
Toutes les actions du Royaume qui appellent une IA consomment de **l'Eau Magique**.
L'utilisateur voit en permanence en haut-droite une **jauge d'eau** qui se vide.

### Le triple compteur (visible côte à côte)

| Métrique | Symbole | Référence |
|---|---|---|
| **Tokens** | 🔮 | 1 token ≈ $0.000003 (Claude Sonnet 3.5 input) |
| **Eau physique** | 💧 | ~10 mL d'eau de cooling datacenter par réponse IA moyenne |
| **Coût** | 🪙 | $0.000003 × tokens + amortissement compute |

**Affichage exemple** :
```
🔮 12 480 tokens   💧 187 mL   🪙 $0.037
```

### Quand l'eau coule
- Lancer un tour vocal Yamzy → 1 goutte
- Demander un audit Voice Narrator → 80 gouttes
- Générer une analyse Phoenix Forge → 200 gouttes
- Refinement IA sur un ticket → 30 gouttes
- Yamzy donne un conseil ad-hoc → 5 gouttes

### La métaphore visuelle
- **Mana Fountain** = source au cœur du Royaume. Niveau de l'eau visible = budget restant
- **Jauge globale** = mini-icône en haut-droite, cliquable → ouvre la Mana Fountain
- Chaque clic IA = goutte qui tombe visible (anim) + son `ping-1.mp3`
- À la fin du sprint → bilan : *"Ce sprint a consommé 2.4 L d'eau et coûté $4.20"*

---

## 🏛 Les 8 Nouvelles Workshop Rooms

### 1. 💧 La Fontaine de Mana — Sensibilisation IA / Eau
> **Workshop** : Visite de la fontaine pour comprendre ce que consomme une magie IA
> **Métaphore** : Source vivante dans la chambre du Conclave. Le niveau d'eau baisse en live à chaque appel IA. Stats du jour, du sprint, du trimestre. Bilan environnemental.
> **3D** : Fontaine circulaire en pierre + colonne d'eau lumineuse + niveau d'eau réel + 4 statuettes (token / mL / $ / CO₂)
> **Activités** :
> - 🌊 Voir la goutte tomber en live à chaque action IA
> - 📊 Bilan du sprint : eau totale, équivalent (douches, bouteilles, piscines)
> - 🎓 Quiz pédagogique : "Sais-tu combien d'eau une question Yamzy consomme ?"
> - 💸 Réglage du budget : seuil d'alerte, pause auto IA si dépassement
> **Route** : `/mana-fountain`
> **Status** : 🟢 Priorité 1 — à construire en premier

---

### 2. ⛵ Le Cercle du Rétroviseur — Rétrospective (Sailboat)
> **Workshop** : Sprint retrospective format Sailboat
> **Métaphore** : Un navire sur la mer qui navigue vers une île (l'objectif). Le vent le pousse (ce qui marche). Les ancres le freinent (ce qui bloque). Les récifs le menacent (risques). L'île est l'objectif.
> **3D** : Sailboat 3D au centre d'un océan ondulant. Île verte à l'horizon. Le navire bouge selon le score d'équipe.
> **Sticky notes** : 4 zones où on ajoute des notes : vent (✓), ancres (✗), récifs (⚠), île (🎯)
> **Activités** :
> - 🎉 Glad (ce qu'on a aimé) → vent gonfle la voile
> - 😢 Sad (déceptions) → ancres tombent dans l'eau
> - 😡 Mad (frustrations) → récifs apparaissent
> - 🎯 Action items → drapeaux plantés sur l'île
> **Variants** : Liked/Learned/Lacked/Longed-for, Start/Stop/Continue, Mad/Sad/Glad
> **Route** : `/retrospective-cove`
> **Status** : 🟡 Priorité 2

---

### 3. ⚰ Le Caveau des Pré-Mortems — Pre-mortem Workshop
> **Workshop** : Imaginer les façons dont le projet pourrait mourir
> **Métaphore** : Crypte souterraine où l'équipe descend imaginer les scénarios d'échec. Chaque sarcophage = une cause de mort.
> **3D** : Crypte gothique avec 6-10 sarcophages alignés. Chaque sarcophage a une plaque (cause de mort) + score (probabilité × impact).
> **Activités** :
> - ⚰ Ajout d'un sarcophage : *"Et si l'API se déprécie en cours de sprint ?"*
> - 🕯 Chacun allume une bougie sur les sarcophages les plus probables (vote)
> - 🛡 Définition de la contre-mesure → grave une rune sur le sarcophage
> - 📜 Export : checklist preventive
> **Route** : `/premortem-crypt`
> **Status** : 🟡 Priorité 2

---

### 4. 🏔 La Carte des Sentiers — Story Mapping
> **Workshop** : Story Mapping (Jeff Patton)
> **Métaphore** : Une montagne avec des sentiers (user journeys). Chaque pierre sur un sentier = une user story. Les niveaux verticaux = MVP, MVP+, futur.
> **3D** : Montagne 3D avec 3-5 sentiers horizontaux. Chaque "marker" sur un sentier = une carte avec titre + score.
> **Activités** :
> - 🚶 Définir les "epics" = sentiers principaux
> - 🪨 Poser les "stories" comme pierres le long du sentier
> - 🏁 Tirer la ligne de release (couper horizontalement à un niveau)
> - 🎯 Identifier le "walking skeleton" (chemin minimum vers le sommet)
> **Route** : `/story-trail`
> **Status** : 🟡 Priorité 2

---

### 5. ☕ La Brûlerie Lean — Lean Coffee
> **Workshop** : Lean Coffee (agenda démocratique)
> **Métaphore** : Café-bar avec 4 zones : *To Discuss*, *Discussing* (bar), *Discussed* (tables), *Action* (étagère). Chaque sujet = une tasse de café qui se déplace.
> **3D** : Café 3D vue de dessus, comptoir avec tasses + tables + étagère.
> **Activités** :
> - 📝 Ajouter des sujets (tasses) au bac *To Discuss*
> - 🗳 Vote par dot voting (sucres dans la tasse)
> - ⏰ Timer 5 min par sujet (la tasse fume)
> - 👍/👎 Continuer ou passer (la tasse va à *Discussed* ou retour au bac)
> **Route** : `/lean-coffee`
> **Status** : 🔵 Priorité 3

---

### 6. 🍇 Le Verger des Affinages — Backlog Refinement
> **Workshop** : Backlog refinement / grooming
> **Métaphore** : Verger avec arbres porteurs de fruits (tickets). Fruits verts = non affinés. Fruits dorés = DoR respecté.
> **3D** : Verger 3D avec 5-8 arbres. Chaque fruit = un ticket. Le fruit mûrit visuellement quand : critères d'acceptation OK / estimé / découpé / dépendances OK.
> **Activités** :
> - 🪜 Cueillir un fruit (sélectionner un ticket)
> - ✂ Couper en plusieurs si trop gros (split story)
> - 📏 Estimer (Fibonacci ou T-shirt)
> - ✅ Cocher DoR : objectif clair / critères / dépendances
> - 🌟 Quand mûr → tombe dans le panier sprint
> **Route** : `/refinement-orchard`
> **Status** : 🔵 Priorité 3

---

### 7. 🪨 Le Puits des Cinq Pourquoi — Root Cause Analysis
> **Workshop** : 5 Whys (Toyota method)
> **Métaphore** : Puits profond. À chaque niveau, on descend en demandant "Pourquoi ?" jusqu'à atteindre la racine.
> **3D** : Puits 3D vertical. 6 plateformes empilées. Caméra descend à chaque "Pourquoi". Au fond : la racine (un rocher avec une rune).
> **Activités** :
> - 🪨 Pose le problème en haut (Niveau 0)
> - ❓ Niveau 1 : "Pourquoi ?" → réponse
> - ❓ Niveau 2 : "Pourquoi cette cause ?" → réponse
> - ... jusqu'au niveau 5
> - 🛡 Définit l'action de fond (qui supprime la racine, pas le symptôme)
> **Route** : `/five-whys-well`
> **Status** : 🔵 Priorité 3

---

### 8. 🏖 La Plage des Définitions — DoR/DoD
> **Workshop** : Définition de Ready / Definition of Done
> **Métaphore** : Plage avec 2 rangées de drapeaux : "READY" et "DONE". Chaque drapeau = un critère.
> **3D** : Plage 3D avec 2 zones séparées par une corde. Drapeaux plantés dans le sable.
> **Activités** :
> - 🏳 Ajouter un drapeau côté READY (ex: "critères d'acceptation rédigés")
> - 🏳 Ajouter un drapeau côté DONE (ex: "tests E2E green")
> - ⛓ Lier les drapeaux entre eux (DoR x → DoD y)
> - 📤 Export DoR/DoD comme markdown dans le repo
> **Route** : `/definitions-beach`
> **Status** : 🔵 Priorité 3

---

## 🎯 Ordre de Construction

### Sprint immédiat (= cette session)
1. **MagicWaterService** + **MagicWaterMeter** (jauge globale top-right)
2. **Mana Fountain Room** complète (la pièce-clé du concept eau/IA)
3. **Design doc** (= ce fichier)
4. **Ajout route + gallery**

### Sprint +1
5. **Le Cercle du Rétroviseur** (Sailboat retrospective)
6. **Le Caveau des Pré-Mortems**

### Sprint +2
7. **La Carte des Sentiers** (Story mapping)
8. **La Brûlerie Lean**

### Sprint +3
9. **Le Verger des Affinages**
10. **Le Puits des Cinq Pourquoi**
11. **La Plage des Définitions**

---

## 🌍 Impact Pédagogique Attendu

Quand un utilisateur termine sa première semaine et regarde son bilan eau :

> **"Cette semaine tu as utilisé Yamzy pour 247 actions IA.**
> **C'est 2 470 mL d'eau (≈ 5 bouteilles 50cL) et $4.10.**
> **Si tu fais ça toute l'année, c'est 128 L d'eau et $213."**

→ Sensibilisation immédiate, non culpabilisante, instrumentée.

---

## 🪙 Coûts de Référence (mai 2026)

| Action | Tokens IN | Tokens OUT | $ | Eau (mL) |
|---|---|---|---|---|
| Tour vocal Yamzy (14 pages) | 8 000 | 12 000 | $0.060 | 24 |
| Audit de PR Mirror Hall | 25 000 | 6 000 | $0.105 | 32 |
| Refinement IA d'un ticket | 3 000 | 1 500 | $0.013 | 5 |
| Génération de retro draft | 6 000 | 3 000 | $0.027 | 11 |
| Question ad-hoc à Yamzy | 1 500 | 800 | $0.007 | 3 |

(Source : Anthropic pricing 2026, AWS water-cooling datacenters approximation)

---

*Concept : faire de la sensibilisation à l'empreinte IA un élément ludique et instrumenté
plutôt qu'un message culpabilisant. Le Royaume vit grâce à l'eau — l'utiliser, c'est
en avoir conscience.*
