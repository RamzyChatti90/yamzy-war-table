# 🌌 Pattern : Publier sur le CeremonyBus depuis une Room

Pour qu'une nouvelle Room publie automatiquement ses cérémonies sur le bus global
(et donc apparaisse dans le ciel de Telescope Island, ou tout autre listener), ajoute
ce pattern à 3 endroits.

## 1. Import du service (en haut du fichier)

```ts
import { CeremonyBusService } from '../../core/ceremony-bus/ceremony-bus.service';
```

## 2. Injection (dans la classe, près des autres inject)

```ts
private ceremonyBus = inject(CeremonyBusService);
```

## 3. Publication dans `emitCeremony(c)` (UNE seule ligne)

```ts
private emitCeremony(c: { type: string; label: string; icon: string }) {
  // 🌌 Publication sur le bus global — telescope-island & co reçoivent
  this.ceremonyBus.publishFromRoom('<MON-ROOM-KEY>', c);
  // Effet local (flash overlay)
  this.ceremonyFlash.set(c);
  if (this.ceremonyFlashTimer) clearTimeout(this.ceremonyFlashTimer);
  this.ceremonyFlashTimer = setTimeout(() => this.ceremonyFlash.set(null), 1400);
}
```

## RoomKey à utiliser

C'est le même `roomKey` que celui passé à `narrator.attach({ roomKey: '...' })`.
Exemples :
- `kanban-island`
- `phoenix-forge`
- `okr-mountain`
- `git-tree-room`
- `library-cathedral`
- `oracle-aquarium`
- `alchemist-cellar`
- `card-tavern`
- `pr-mirror-hall`
- `star-map-risks`
- `telescope-island` *(attention : telescope est ALSO subscriber, pas la peine de publier les events qu'il triggers lui-même)*

## Pour les futures rooms générées par le Studio Maker

Le template de génération de room doit inclure les 3 lignes ci-dessus.
Cf. `yamzy-studio-maker.component.ts` → fonction qui scaffold un nouveau component.

## Mapping cérémonie → phénomène céleste

Le ciel de Telescope Island traduit le `type` en phénomène céleste via la table
`CEREMONY_TO_SKY` dans `ceremony-bus.service.ts`. Si tu inventes un nouveau type,
ajoute-le à cette table pour qu'il ait un phénomène associé.

Catalogue actuel (extrait) :
| Type cérémonie | Phénomène céleste |
|---|---|
| `renaissance` / `harvest` / `release` / `comet` | ☄ Comète |
| `eclipse` / `siren` | 🌑 Éclipse |
| `death` / `rollback` / `incident` / `storm` / `feu` | ⚡ Tempête solaire |
| `debarquement` / `meteor` / `fall` / `pruning` | ⭐ Pluie de météores |
| `sommet` / `aurora` | 🌌 Aurora |
| `aube` / `dawn` / `bloom` / `nebula` | 🌫 Nébuleuse |
| `major-release` / `supernova` | 💥 Supernova |
| `flag` / `shooting-star` | 🌠 Étoile filante |
| `solstice` / `crescent` | 🌙 Croissant de lune |
| `conjunction` | 🪐 Conjonction planétaire |
| *(par défaut)* | 🌠 Étoile filante |
