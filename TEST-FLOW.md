# WAR TABLE ⚔ — Test Flow (Base fraîche)

> Guide pour tester de bout en bout l'extension depuis Yamzy World, en mode privé/local.

## Prérequis

- Yamzy World principal qui tourne (frontend :4200 + backend :8080 + postgres :5432)
- Tu es loggé sur http://localhost:4200

## 1. Repartir d'une base fraîche

```powershell
# Vide TOUTES les tables pos_* (préserve le DDL, restart identity)
docker exec -i yamzy-postgres psql -U yamzy -d yamzy_world < reset-db.sql
```

Vérif : la requête retourne `0` pour toutes les tables.

## 2. Désinstaller l'éventuelle install précédente

```powershell
cd C:\Users\DGNB6786\Downloads\yamzy-world_126_58\yamzy-war-table-frontend
.\uninstall-local.ps1
```

## 3. Aller sur Yamzy World

→ http://localhost:4200/dashboard-beta

Tu dois voir une carte **WAR TABLE ⚔** dans la grille de menus avec le badge `⬇ INSTALL` (ou similaire).

## 4. Cliquer "Installer l'extension"

Un modal s'ouvre avec :
- Description de l'extension
- Commande PowerShell à copier :
  ```powershell
  cd C:\Users\DGNB6786\Downloads\yamzy-world_126_58\yamzy-war-table-frontend
  .\install-local.ps1
  ```
- Bouton **Copier**

## 5. Coller dans PowerShell

Le script :
1. Vérifie node + npm + backend :8080
2. npm install si node_modules absent
3. Lance `ng serve --port 4201` en arrière-plan
4. Attend que :4201 réponde
5. Enregistre dans `~/.yamzy/extensions.json`
6. **Ouvre automatiquement** http://localhost:4200/auth/bridge?return=http://localhost:4201/war-table

## 6. Le studio s'ouvre

Le bridge SSO transfère ton JWT, tu atterris sur http://localhost:4201/war-table déjà authentifié.

Tu vois :
- Le splash "Planification Temporelle" 3-4s
- Le studio chargé en empty state (DB vide → "Aucun planning")
- Le bouton **⬆ Importer Excel** prêt

## 7. Importer ton Excel

Dépose `Backlog_MultiProjets_Unifie_v19_6.xlsx` → 2 projets · 29 tickets · 6 sprints · etc.

## 8. Tester les features

- Navigation sidebar 4 icônes (Dashboard / Plannings / Backlog / Analytics)
- Drawer MORE pour les 42 pages
- Recherche globale dans le header
- Pagination 5 par page
- Export Excel → fichier identique à l'import (round-trip)
- Versioning : snapshot, restore

## 9. Stop et retour à la base fraîche

```powershell
.\uninstall-local.ps1                       # stop le serveur :4201
docker exec -i yamzy-postgres psql -U yamzy -d yamzy_world < reset-db.sql   # vide la DB
```

## 🔒 Mode privé

Cette extension est **privée** :
- `extension.json` → `"visibility": "private"`
- Pas de repo GitHub publié
- Pas d'image Docker publique
- Sources gardées dans `C:\Users\DGNB6786\Downloads\yamzy-world_126_58\yamzy-war-table-frontend\`

Quand tu voudras la publier plus tard : passe `visibility` à `"public"` et utilise `install.ps1` (qui clone depuis GitHub) au lieu de `install-local.ps1`.

## 📂 Fichiers de mode privé

| Fichier | Rôle |
|---------|------|
| `install-local.ps1` | Installeur local (npm start) — **utiliser maintenant** |
| `uninstall-local.ps1` | Stop + désinscrit |
| `reset-db.sql` | Vide les tables pos_* |
| `install.ps1` | Installeur public via git clone — **plus tard** |
| `install.sh` | idem Linux/macOS — **plus tard** |
| `Dockerfile` / `docker-compose.yml` | Pour publication officielle — **plus tard** |
