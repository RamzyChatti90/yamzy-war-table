# Contribuer à WAR TABLE ⚔

Merci de l'intérêt ! Ce guide explique comment proposer une amélioration, un bug fix ou une nouvelle feature.

## Sommaire

- [Code of conduct](#code-of-conduct)
- [Workflow Scrum](#workflow-scrum)
- [Branch strategy (GitFlow simplifié)](#branch-strategy)
- [Cycle d'une contribution](#cycle-dune-contribution)
- [Conventions de commit](#conventions-de-commit)
- [Pull Request](#pull-request)
- [Release process](#release-process)

---

## Code of conduct

- Sois respectueux dans les discussions (issues, PRs, commentaires)
- Pas de commit de secrets (utilise `*.example` pour les configs)
- Cite tes sources si tu t'inspires d'un projet externe

---

## Workflow Scrum

| Cérémonie | Cadence | Output |
|-----------|---------|--------|
| **Sprint Planning** | Tous les lundis matin | Backlog du sprint figé (10-15 issues) |
| **Daily Standup** | 9h30 (15 min max) | Bloqueurs identifiés |
| **Sprint Review** | Vendredi après-midi | Demo des features livrées |
| **Retrospective** | Vendredi fin de journée | 3 actions concrètes pour le sprint suivant |

**Sprints de 2 semaines** · backlog géré sur [GitHub Projects](https://github.com/RamzyChatti90/yamzy-war-table/projects).

**Definition of Ready (DoR)** — une issue peut entrer dans un sprint si :
- [ ] User story claire : `En tant que <rôle>, je veux <action>, afin de <bénéfice>`
- [ ] Critères d'acceptation (Gherkin Given/When/Then)
- [ ] Story points estimés (Fibonacci : 1, 2, 3, 5, 8, 13)
- [ ] Dépendances identifiées (aucun blocker en amont)
- [ ] Mockup/specs si UI

**Definition of Done (DoD)** — une issue est fermée si :
- [ ] Code mergé sur `develop`
- [ ] Tests unitaires passent (si applicable)
- [ ] PR approuvée par 1+ reviewer
- [ ] CHANGELOG.md mis à jour
- [ ] Démo faite au PO

---

## Branch strategy

GitFlow simplifié (pour éviter la complexité du vrai GitFlow) :

```
main         ←── tags v1.0.0, v1.0.1, v1.1.0  (production stable)
  ↑
develop      ←── travail courant (intégration continue)
  ↑
feature/*    ←── nouvelle feature
bugfix/*     ←── correctif bug non urgent
hotfix/*     ←── correctif urgent (branche depuis main, merge dans main+develop)
release/*    ←── préparation release (figer features, polish, doc)
```

### Conventions de noms de branche

| Préfixe | Pattern | Exemple |
|---------|---------|---------|
| Feature | `feature/<issue-id>-<slug>` | `feature/42-gantt-zoom` |
| Bug fix | `bugfix/<issue-id>-<slug>` | `bugfix/87-export-formatting` |
| Hotfix prod | `hotfix/<version>-<slug>` | `hotfix/1.0.1-security-jwt` |
| Release | `release/<version>` | `release/1.1.0` |

### Qui peut merger sur quoi

- `feature/*` → `develop` : 1 reviewer
- `develop` → `release/*` : décision sprint review
- `release/*` → `main` + tag : maintainer
- `hotfix/*` → `main` + `develop` : maintainer + 1 reviewer

---

## Cycle d'une contribution

### 1. Trouve ou crée une issue

- Bug ? Utilise le [template Bug Report](./.github/ISSUE_TEMPLATE/bug_report.md)
- Feature ? Utilise le [template Feature Request](./.github/ISSUE_TEMPLATE/feature_request.md)

L'issue doit être labellisée (`bug`, `feature`, `priority:must`, etc.) et assignée à un sprint pour être éligible au dev.

### 2. Fork (ou branche directe si tu es contributeur) + crée ta branche

```bash
git checkout develop
git pull origin develop
git checkout -b feature/42-gantt-zoom
```

### 3. Code + commit

Suis les [conventions de commit](#conventions-de-commit).

### 4. Push + ouvre une PR

```bash
git push -u origin feature/42-gantt-zoom
```

Ouvre une PR vers `develop` (pas `main` !). Utilise le [template PR](./.github/PULL_REQUEST_TEMPLATE.md).

### 5. Code review

Le reviewer vérifie :
- [ ] Le code compile + tests passent (CI verte)
- [ ] La feature couvre tous les critères d'acceptation de l'issue
- [ ] Le CHANGELOG.md est mis à jour (section `[Unreleased]`)
- [ ] Pas de secrets ou de code mort introduits

### 6. Merge + close l'issue

Merge avec **squash** (1 commit propre par issue dans l'historique).

---

## Conventions de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
<type>(<scope>): <description courte>

<corps optionnel — détail technique>

<footer optionnel — refs issues, breaking changes>
```

| Type | Quand l'utiliser |
|------|------------------|
| `feat` | nouvelle feature |
| `fix` | bug fix |
| `docs` | doc uniquement |
| `style` | formatting (pas de changement comportemental) |
| `refactor` | refacto sans changement fonctionnel |
| `perf` | amélioration perf |
| `test` | ajout/correction tests |
| `chore` | maintenance (deps, config, build) |

**Exemples** :

```
feat(gantt): ajout zoom horizontal (week/month/quarter)

Refs #42
```

```
fix(import): handle Excel cells with null formula result

Closes #87
```

```
feat!: drop support for Java 17 (BREAKING)

BREAKING CHANGE: minimum Java version is now 21.
Update your `JAVA_HOME` before upgrading.
```

**Footer obligatoire pour les contributeurs** :

```
Signed-by: <Ton nom>
```

(Aucune mention "Co-Authored-By: AI/IA assistant" — c'est ton travail.)

---

## Pull Request

- 1 PR = 1 issue (sauf petits commits techniques groupés)
- Titre = nom de la branche (`feature/42-gantt-zoom`) ou format Conventional Commits
- Description : voir le [template](./.github/PULL_REQUEST_TEMPLATE.md)
- Aucune PR n'est mergée sans : CI verte + 1 approval + CHANGELOG mis à jour
- Auto-merge activé pour les `dependabot/*` (mineures uniquement)

---

## Release process

### Stable release (depuis `release/X.Y.0`)

```bash
# 1. Crée la branche release depuis develop
git checkout develop && git pull
git checkout -b release/1.1.0

# 2. Bump version dans :
#    - package.json
#    - extension.json
#    - CHANGELOG.md (déplace [Unreleased] → [1.1.0] — YYYY-MM-DD)

# 3. Commit
git commit -am "chore(release): 1.1.0"

# 4. Merge vers main + tag
git checkout main && git pull
git merge --no-ff release/1.1.0
git tag -a v1.1.0 -m "WAR TABLE 1.1.0"
git push origin main --tags

# 5. Merge back vers develop pour récupérer le bump
git checkout develop
git merge --no-ff release/1.1.0
git push origin develop

# 6. GitHub Actions build le JAR + push l'image Docker + crée la GitHub Release
```

### Hotfix urgent (depuis `main`)

```bash
git checkout main && git pull
git checkout -b hotfix/1.0.1-security-jwt
# Fix...
git commit -am "fix(security): rotate JWT secret on logout"

# Bump patch version
# Merge vers main + tag
git checkout main && git merge --no-ff hotfix/1.0.1-security-jwt
git tag -a v1.0.1 -m "WAR TABLE 1.0.1 hotfix"
git push origin main --tags

# Merge back vers develop
git checkout develop && git merge --no-ff hotfix/1.0.1-security-jwt
git push origin develop
```

### Versioning SemVer

| Bump | Quand |
|------|-------|
| **MAJOR** (X.0.0) | Breaking change (API supprimée, schema DB incompatible) |
| **MINOR** (X.Y.0) | Nouvelle feature backward-compat |
| **PATCH** (X.Y.Z) | Bug fix backward-compat |

Pre-releases : `1.1.0-alpha.1`, `1.1.0-beta.2`, `1.1.0-rc.1`.

---

## Questions ?

Ouvre une [Discussion](https://github.com/RamzyChatti90/yamzy-war-table/discussions) ou ping `@RamzyChatti90`.

---

**Maintainers** : [@RamzyChatti90](https://github.com/RamzyChatti90)
