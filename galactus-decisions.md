# Galactus — Journal des décisions techniques (append-only)

Une entrée par décision structurante. Datée. Avec **Raison** + **Conséquence si on change**. Ne jamais modifier une entrée existante — ajouter une nouvelle entrée si la décision évolue.

---

## 2026-05-22 — Décisions Sprint 0

### 1. Rebuild propre vs migration progressive → **rebuild**

- **Raison** : architecture monolithe HTML legacy (vues Saisie/Tableau/Documents, palette TDM v1.1 terracotta, fonts Spectral) radicalement incompatible avec la cible (4 vues, palette cosmic/magenta, Alpine modulaire). Migration progressive aurait imposé une double maintenance.
- **Conséquence si on change** : impossible de revenir en arrière sans réécrire l'archive `archive/index-legacy-frais-tournage.html`.

### 2. Bundle wireframes Claude Design → `design-handoff/` gitignored

- **Raison** : 1.2 MB de références visuelles (wire.jsx, screens-*.jsx, uploads/), pas pertinent à versionner dans le repo.
- **Conséquence si on change** : si Pierre change de machine, re-extraire `~/Downloads/Galactus-handoff.zip` dans `design-handoff/`.

### 3. Rename dossier local `TDMstudio-frais-tournage/` → `galactus/`

- **Raison** : cohérence avec le rename GitHub effectué pré-Sprint 0.
- **Conséquence si on change** : raccourcis IDE/shell à adapter, anciens chemins absolus dans scripts Pierre potentiellement à corriger.

### 4. Hash de déduplication : MD5 → **SHA-256**

- **Raison** : Web Crypto SubtleCrypto n'expose pas MD5 nativement. Inclure une mini-lib MD5 externe pour un seul usage = dette inutile.
- **Conséquence si on change** : si Pierre veut comparer un hash galactus à un MD5 calculé par un outil externe, incompatible. Le schéma DB conserve la colonne `pieces.hash_md5` (nom legacy) mais le contenu est en réalité SHA-256. À documenter explicitement dans `js/utils.js` au Sprint 1.

### 5. Variante mobile Ingestion = **A** (2 gros boutons)

- **Raison** : variante A (`IngestionHomeMobileA` du bundle wireframes) = 2 gros boutons "📷 Prendre en photo" / "📎 Choisir un fichier". Choix arbitré session design 2026-05-21.
- **Conséquence si on change** : la variante B (caméra-first plein écran avec corner brackets) est reportée Sprint 5 polish pour évaluation après usage S1 tournage.

### 6. Source de vérité migrations DB = **Supabase**, pas dual

- **Raison** : MCP `apply_migration` génère lui-même les fichiers côté Supabase. Dupliquer en local = risque de désync.
- **Conséquence si on change** : les 6 fichiers SQL locaux dans `supabase/migrations/` (timestamps Supabase officiels) sont la copie miroir Sprint 0 — pour permettre `supabase db pull` futur si CLI installée.

### 7. Buckets Storage `galactus-input` + `galactus-output` = **privés** avec policies anon full access

- **Raison** : cohérence sécu avec le sprint RLS parallèle (transition future vers authenticated user only). Aujourd'hui : policies anon calquées sur `justificatifs-frais` legacy (le pattern actuel du projet).
- **Conséquence si on change** : Sprint sécu RLS S23-24 durcira les policies (restriction à `auth.uid()` du compte Pierre). Sprint 3 vue Pièces utilisera des **signed URLs** pour servir les images (les URLs `/object/public/galactus-input/...` ne fonctionneront pas sur bucket privé en lecture).

### 8. Migration des 14 justificatifs legacy = **dès Sprint 0** via API HTTP

- **Raison** : éviter dette cohabitation entre 3 buckets. Téléchargement via URLs publiques `justificatifs-frais` + re-upload via API anon dans `galactus-input` (les policies anon insert créées Sprint 0 le permettent).
- **Conséquence si on change** : `justificatifs-frais` reste actif comme backup 3 mois (drop programmé 2026-08-22). Si rollback nécessaire avant 3 mois, UPDATE inverse dispo dans migration 06.

### 9. JWT custom expiry 30 jours **annulé** → défauts Supabase Free plan acceptés

- **Contexte** : le brief Sprint 0 prévoyait JWT TTL = 2 592 000s (30 jours) pour éviter les reloginsfréquents.
- **Constat 2026-05-22** : la config "User Sessions" (Time-box, Inactivity timeout) est verrouillée Pro plan dans le dashboard Supabase. Sur Free, JWT access token = 1h fixé, refresh token rotating activé par défaut.
- **Raison de l'annulation** : la lib `@supabase/supabase-js` rafraîchit automatiquement le JWT en arrière-plan tant que le refresh token est valide. Effet pratique pour Pierre = identique (pas de relogin forcé toutes les heures). Pas de valeur ajoutée à passer Pro pour ce seul réglage au stade MVP.
- **Conséquence si on change** : si passage Pro plan futur pour d'autres raisons (volume, support), on pourra étendre Time-box session à 30j pour aligner sur le brief original. Sinon, défauts Free suffisent.

---

## 2026-05-22 — Décisions Sprint 1

### 10. Tailwind CDN accepté en MVP, migration CLI précompilé reportée Sprint 5+

- **Contexte** : le brief acte le risque "Tailwind CDN ~1.5 MB pénalise PWA mobile" et propose une migration CLI si problème en Sprint 5.
- **Décision Sprint 1** : on garde `cdn.tailwindcss.com` (~1.5 MB premier load). Le service worker cache shell absorbe la lib après le 1er chargement, donc le coût n'est payé qu'une fois.
- **Trade-off accepté** : warning console permanent `cdn.tailwindcss.com should not be used in production`. Documenté dans `PROJET_galactus.md` ERREURS CONNUES.
- **Conséquence si on change** : si Sprint 5 décide de migrer, prévoir : (a) installer Tailwind CLI via npx one-shot (pas de bundler MVP), (b) générer `css/tailwind.compiled.css` par scan des classes utilisées dans `index.html` + `js/*.js`, (c) remplacer le `<script src="cdn.tailwindcss.com">` + config inline par un `<link rel="stylesheet" href="css/tailwind.compiled.css">`, (d) script de rebuild ajouté à README.

### 11. Pattern composants UI = Tailwind utility classes inline (pas de framework)

- **Contexte** : le brief évoque "web components custom" comme alternative, écartés au profit de "classes utility Tailwind composées directement dans le HTML".
- **Décision** : implémentation Sprint 1 confirme — chaque composant (Btn, AccentBtn, Badge, Field, KPI) est une combinaison de classes utility Tailwind écrite inline dans `index.html`, avec quelques helpers Alpine pour l'état dynamique (active/hover/disabled). Aucun web component, aucun fichier `.js` dédié composant.
- **Raison** : simplicité MVP, debug visuel direct, pas de couche d'abstraction supplémentaire. Plus verbeux mais lisible.
- **Conséquence si on change** : si Sprint 5+ décide d'introduire des web components (réutilisabilité Sprints 6+ multi-projets), prévoir refactor de `index.html` (extraction Btn, Badge, KPI en `<gx-btn>`, `<gx-badge>`, etc.). Pas critique aujourd'hui — Galactus reste mono-page.

### 12. Page démo `#/_demo` = référence visuelle pérenne, cachée de la nav

- **Contexte** : extension du plan (MOD-10) au-delà du brief initial. Section design system rendue côté app via une vue Alpine cachée de la nav (4 vues métier seulement dans sidebar/tab bar).
- **Décision** : `#/_demo` accessible uniquement via URL directe, 14 sections (typographie, palette, badges, boutons, fields, KPI, box, placeholder, bannière, loader vortex). Sert de vérification visuelle Pierre + référence Claude Code en Sprints 2-4.
- **Raison** : la route est dans la liste autorisée du router (`['ingestion','dashboard','pieces','exports','_demo']`) mais n'est pas listée dans la sidebar/tab bar. Pierre garde le contrôle visuel sans pollution UX.
- **Conséquence si on change** : si Sprint 5 polish décide de la supprimer (page de "doc dev" pas utile en prod), retirer `_demo` du `allowed` array dans `js/app.js` + retirer la `<template x-if="currentView === '_demo'">` dans `index.html`. Garder `docs/DESIGN.md` comme référence statique.

### 13. PWA icons = placeholders Pillow Python générés au Sprint 1

- **Contexte** : pas d'asset designer prêt au Sprint 1.
- **Décision** : `icons/_generate.py` (PIL) génère deux PNG 192/512 = gradient radial cosmos→violet→accent→gold + lettre G blanche serif gras. Script committé pour future regénération.
- **Raison** : éviter dépendance asset externe Sprint 1. Le placeholder respecte la palette cosmic et la lettre G iconique.
- **Conséquence si on change** : Sprint 5 polish prévu pour remplacer par un asset designer dédié (cohérence avec d'éventuels favicons custom). Si Pierre veut changer dès maintenant, éditer `icons/_generate.py` (taille du G, gradient, font fallback liste) et relancer.
