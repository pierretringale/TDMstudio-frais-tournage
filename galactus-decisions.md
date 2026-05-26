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

---

## 2026-05-26 — Décisions Sprint 2

### 14. Conversion image → PDF **côté CLIENT** via `pdf-lib@1.17.1` UMD

- **Contexte** : Sprint 2 doit générer un PDF unique consolidé multi-pages pour bucket `galactus-output`. Le brief original mentionne "pdf-lib côté Edge Function".
- **Décision** : `pdf-lib` chargé côté client via CDN unpkg (`<script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js">`). `buildPdfFromPages()` dans `js/ingestion.js` utilise `window.PDFLib.PDFDocument` pour embed JPG/PNG en page A4 portrait centrée ou `copyPages` si PDF source.
- **Raison** : (a) latence locale Mac M-series <500ms vs cold-start Deno 1-3s + invocation supplémentaire Edge ; (b) la fonction Edge `analyze-receipt` reste pure OCR, single responsibility ; (c) `pdf-lib` couvre les deux cas (embed image + copy PDF) avec une seule API ; (d) ~170 KB minifié — absorbé par le service worker cache shell après 1ʳᵉ visite.
- **Conséquence si on change** : si Sprint 5 décide de self-host `pdf-lib` (risque CDN unpkg down → `window.PDFLib` undefined), copier le min.js dans `/lib/pdf-lib.min.js` + adapter le `<script src>` + ajouter au cache shell SW.

### 15. HEIC iPhone non géré in-app — bascule iOS forcée

- **Contexte** : iPhone récent prend des photos en HEIC par défaut. `pdf-lib` ne sait pas lire HEIC.
- **Décision** : input `accept="image/jpeg,image/png,application/pdf"` côté camera et file picker. Toast clair si HEIC slip-through ("Active JPG dans Réglages iPhone > Appareil photo > Formats > Le plus compatible"). Documenté `docs/gouvernance/erreurs-connues.md`.
- **Raison** : ajouter `heic2any` UMD (~300 KB) alourdirait le shell PWA et coûterait 1-2s de conversion par photo. Le réglage iOS Settings > Camera > Formats > Most Compatible règle 100% du problème côté utilisateur (Pierre) avec 0 code. Choix Pierre validé via AskUserQuestion 2026-05-26.
- **Conséquence si on change** : si Pierre veut tolérer HEIC sans réglage iOS (autres utilisateurs futurs, partage de photos d'amis), ajouter `<script src="heic2any.min.js">` + conversion préalable dans `pushPage()` avant `pdf-lib`.

### 16. Confidence stockée en 0-1 dans `pieces.confiance_ocr`, `confidence_per_field` volatile UI

- **Contexte** : schéma DB Sprint 0 a `confiance_ocr numeric(3,2)` (max 9.99). Le brief mentionne échelle 0-100 et 0-1 selon les sections.
- **Décision** : Edge Function `analyze-receipt` retourne confidence en 0-1 (décimal). INSERT pieces stocke directement en 0-1 dans `confiance_ocr`. L'UI affiche en pourcentage (`Math.round(c * 100)`). **`confidence_per_field` n'est PAS persisté Sprint 2** — info volatile UI utilisée uniquement pour border conditionnelle des fields validation.
- **Raison** : (a) cohérence avec schéma DB existant ; (b) `confidence_per_field` non utilisé en Sprints 3-4, ajout colonne dédiée prématuré.
- **Conséquence si on change** : si Sprint 3+ veut analytics OCR (% confidence par fournisseur, evolution dans le temps), ajouter colonne `pieces.confidence_per_field jsonb` via migration mineure + persister dans INSERT.

### 17. Modal doublon — bouton "Créer quand même" disabled Sprint 2 (UX honnête)

- **Contexte** : la contrainte UNIQUE sur `hash_md5` ferait planter l'INSERT si Pierre force la création d'un doublon. Le brief original disait "laisser planter avec toast".
- **Décision** : Sprint 2 = boutons "Créer quand même" et "Voir détail" **disabled** avec tooltip "Disponible Sprint 3". Le modal affiche les **infos de la pièce existante** (badge cat+act, fournisseur, date+TTC formatés, référence, statut) pour que Pierre puisse trancher manuellement. Choix Pierre validé via brief retour 2026-05-26.
- **Raison** : meilleure UX qu'un bouton qui plante. Si Pierre veut vraiment ingérer 2 fois la même pièce (cas rare : 2 factures avec montant identique mais dates différentes), c'est typiquement à fixer Sprint 3 avec une vraie gestion `hash_collision_n`.
- **Conséquence si on change** : Sprint 3 — ajouter migration `ALTER TABLE pieces ADD COLUMN hash_collision_n smallint DEFAULT 0; ALTER TABLE pieces DROP CONSTRAINT pieces_hash_md5_key; ALTER TABLE pieces ADD CONSTRAINT pieces_hash_md5_collision_unique UNIQUE (hash_md5, hash_collision_n);`. Activer le bouton + logique d'incrément côté client.

### 18. Sortie après "Valider et terminer" → `navigate('pieces')` même si placeholder

- **Contexte** : choix UX du retour après ingestion non-rafale.
- **Décision** : `location.hash = '#/pieces'` même si la vue Pièces n'est qu'un placeholder striped Sprint 2. Choix Pierre validé via AskUserQuestion 2026-05-26.
- **Raison** : (a) anticipe le contrat Sprint 3 (Pierre sait que la pièce est trouvable là) ; (b) toast success "Pièce validée — {nom_fichier}" donne le feedback immédiat ; (c) éviter de re-laisser sur `#/ingestion` qui pousserait à ingérer encore.
- **Conséquence si on change** : revenir à `subview='home'` retour `#/ingestion` un simple changement de 2 lignes dans `validateAndSave`. Sprint 3 va de toute façon transformer la vue Pièces en page utile.

### 19. Taux TVA UI = select 5 options [20, 10, 5.5, 0, "autre"] + input conditionnel

- **Contexte** : précision sur l'UX du champ taux TVA dans le formulaire validation.
- **Décision** : `<select>` avec 5 options. Si "Autre" sélectionné → input numeric `step="0.01"` apparait pour saisir un taux exotique (DOM-TOM 8.5%, hébergement 2.1%, etc.). Choix Pierre validé via AskUserQuestion 2026-05-26.
- **Raison** : couvre 99% des cas EURL/IS (20/10/5.5/0) avec UX rapide, garde la flexibilité pour les cas rares sans contrainte.
- **Conséquence si on change** : pas de fallback nécessaire — UX simple. Si Pierre veut un input libre direct sans select, retirer le `<select>` + garder l'input numeric.

### 20. Model string Anthropic : alias **non-daté** `claude-sonnet-4-6` conservé

- **Contexte** : le brief Sprint 2 demandait à vérifier le model string sur docs.claude.com.
- **Décision** : alias non-daté `claude-sonnet-4-6` conservé (utilisé Sprint 0). Choix Pierre validé via AskUserQuestion 2026-05-26 (option "Recommandé").
- **Raison** : on bénéficie automatiquement des updates Anthropic Sonnet 4.6 sans rebuild Edge Function. Cohérent avec MVP single-user (pas de contrainte reproductibilité stricte). `max_tokens: 2500` (élargi vs 500 Sprint 0 pour multi-pages + ocr_text_brut + JSON enrichi).
- **Conséquence si on change** : si Pierre veut figer une version pour reproductibilité compta (audit, archivage), passer à `claude-sonnet-4-6-20XXXX` daté. Vérifier sur https://docs.claude.com la variante disponible.

### 21. Flux INSERT puis uploads parallèles puis UPDATE (évite orphelins)

- **Contexte** : le plan initial prévoyait upload buckets AVANT INSERT pieces. Risque identifié dans le brief retour Pierre 2026-05-26 : si INSERT plante (UNIQUE collision), les fichiers sont déjà uploadés → orphelins permanents dans buckets.
- **Décision** : `validateAndSave` flux corrigé : (1) compose filename, (2) build PDF Blob mémoire, (3) INSERT pieces avec `justificatif_url='pending'`, (4) si INSERT OK uploads parallèles toutes pages dans `galactus-input` (naming `{hash}-p{N}.{ext}`) + PDF dans `galactus-output`, (5) UPDATE pieces avec URLs réelles + `pages jsonb`.
- **Raison** : INSERT atomique en premier, contrainte UNIQUE testée avant upload. Pas d'orphelin possible. Coût marginal : 1 UPDATE supplémentaire (négligeable).
- **Conséquence si on change** : si l'UPDATE plante (rare), la pièce reste avec `justificatif_url='pending'` — Sprint 3 ajoutera un bouton "Réuploader justificatif" dans la modal édition pour récupération.

### 22. Service Worker bumpé `galactus-v2-sprint2`

- **Contexte** : Sprint 2 ajoute `js/ingestion.js` et `pdf-lib.min.js` UMD CDN. Sans bumper le SW Sprint 1 (`galactus-v1-sprint1`), l'ancien cache shell serait servi → `ingestion is not defined` au runtime.
- **Décision** : `CACHE_VERSION` bumpé `galactus-v2-sprint2`. `SHELL_ASSETS` étendu avec `./js/ingestion.js` + `https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js`. Le hook `activate` du SW Sprint 1 purge automatiquement les anciens caches (`keys.filter(k => k !== CACHE_VERSION).map(caches.delete)`).
- **Raison** : invalidation propre du cache PWA, garantit que tous les utilisateurs (Pierre) reçoivent les nouveaux assets dès le prochain load.
- **Conséquence si on change** : chaque sprint future doit bumper `CACHE_VERSION` à `galactus-vN-sprintN`. Sinon ancien cache persiste indéfiniment.

### 23. Hash colonne `pieces.hash_md5` — dette nom legacy assumée

- **Contexte** : Sprint 0 décision 4 a fixé l'utilisation de SHA-256 (Web Crypto). La colonne s'appelle toujours `hash_md5` (nom legacy de la table `frais_tournage` avant rebuild).
- **Décision Sprint 2** : on conserve `hash_md5` comme nom de colonne. Le contenu est SHA-256 hex 64 chars. Tag P3 dans `docs/gouvernance/erreurs-connues.md`.
- **Raison** : pas de migration prioritaire Sprint 2 (1 colonne renommée = 1 migration + adapter tous les helpers + risque sur les 14 lignes legacy). À planifier en sprint dédié.
- **Conséquence si on change** : Sprint 3+ peut faire migration `ALTER TABLE pieces RENAME COLUMN hash_md5 TO hash_sha256;` + update `js/supabase.js` (`findPieceByHash`) + update payload INSERT dans `js/ingestion.js`.

### 24. Rafale mode partagé via `Alpine.store('app').rafaleMode`

- **Contexte** : la tab bar mobile du shell (`index.html` ligne 217) et le composant `ingestion()` sont dans deux scopes Alpine distincts. Le masquage de la tab bar en mode rafale nécessite un état partagé.
- **Décision** : `Alpine.store('app', { rafaleMode: false })` initialisé dans `js/app.js` via le listener `alpine:init`. La tab bar shell lit `$store.app.rafaleMode` (`x-show="!($store.app && $store.app.rafaleMode)"`). `ingestion()` écrit via `Alpine.store('app').rafaleMode = true/false` dans `enterRafale()` / `exitRafale()`.
- **Raison** : pattern Alpine 3 standard pour state global cross-composants. Plus propre qu'un événement custom ou un `window.X = true`.
- **Conséquence si on change** : si Sprint 3+ ajoute d'autres états globaux partagés (theme dark, dashboard period selector), même pattern à étendre dans `Alpine.store('app', {...})`.

### 25. Prompt système OCR Edge Function — version initiale validée Pierre

- **Contexte** : le prompt précédent (Sprint 0) utilisait l'ancienne nomenclature `CATEGORIES = ['Conception & Préparation', ...]` héritée de `frais-tournage`. Incompatible avec les 5 catégories CHECK Postgres galactus.
- **Décision** : prompt complètement réécrit. Définit explicitement les 5 catégories (`fournisseur`, `ndf`, `materiel`, `vente` ; `ndf-mois` exclus car app-only), les 3 activités avec heuristiques (VUM = SaaS marketing/réseaux sociaux + outils dev vu.media, TDM = matériel/tournage/prod, MIX = usage partagé). Format de sortie JSON strict avec `confiance_ocr` + `confidence_per_field` + `ocr_text_brut`. Hint utilisateur prioritaire override.
- **Raison** : (a) alignement strict avec contraintes CHECK Postgres (toute valeur invalide planterait l'INSERT en silencieux 400 — voir CLAUDE.md global Pierre Supabase contraintes CHECK) ; (b) heuristiques activité reflètent la réalité TDM/vu.media (la version brief mentionnait Anthropic comme VUM, Pierre a précisé que c'est plutôt VUM si facturé vu.media — pour l'instant les abonnements Anthropic API restent à classer manuellement).
- **Conséquence si on change** : itérer le prompt après premiers tests fixtures réelles (Pierre). Si les heuristiques activité ratent souvent sur des fournisseurs Anthropic/OpenAI/Replicate, ajouter mentions explicites. Le `ocr_text_brut` retourné permet de debugger les mauvaises classifications.
