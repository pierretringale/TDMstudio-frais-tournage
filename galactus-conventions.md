# Galactus — Conventions techniques (audience Claude Code)

Patterns figés Sprint 0. À respecter dans toute session de build. Pour les conventions **métier** (catégories, statuts, naming pièces), voir `docs/CONVENTIONS.md` (Sprint 1).

---

## Code style

- **ES2022** (`<script type="module">`), pas de bundler MVP.
- **Alpine.js** : un seul `x-data` root dans `<body>` via la fonction `app()`. Sub-state local via `x-data` imbriqué seulement si vraiment isolé.
- **Tailwind utility classes inline** dans HTML, pas de framework de composants lourd. Quelques helpers Alpine pour les états dynamiques (active, hover, disabled).
- **Pas de TypeScript** côté client (uniquement Edge Functions Deno).
- **Pas de commentaires ligne par ligne**. Commentaires de section (`// === ÉTAPE 1 : VALIDATION ===`) obligatoires.
- **Logs en français**, préfixés `[NOM-MODULE]`. Jamais de données personnelles (montants, fournisseurs, descriptions) dans les logs.

## Naming

- **Fonctions** : verbe + objet + contexte. `listerPieces()`, `composerNomFichier()`, `analyserJustificatif()`. Pas `process()`, `handle()`, `doStuff()`.
- **Variables** : explicite. `pieceBrute`, `nomNormalise`, `reponseClaude`. Pas `data`, `res`, `result`.
- **IDs** : nommer avec l'entité. `pieceId`, `fournisseurId`, `userId`. Jamais juste `id`.

## Supabase

- **Client unique** dans `js/supabase.js` (pattern LotR). Jamais d'appel direct à `supabase.from()` ailleurs.
- **Toutes les requêtes DB passent par les helpers** : `listPieces()`, `insertPiece()`, etc.
- **Contraintes CHECK** : silencieuses (400 sans bruit). Toujours vérifier majuscule/minuscule, valeurs exactes des enum.
- **Arrays/JSONB** : toujours `JSON.stringify()` avant insertion. Champ `pieces.pages` = JSONB.

## Routage

- **Hash routing** : `location.hash` = source de vérité de la vue. Pas de state interne dupliqué.
- Vues autorisées Sprint 1 : `ingestion`, `dashboard`, `pieces`, `exports`, `_demo` (cachée, page démo composants visuels MOD-10).
- Listener `hashchange` dans `app.init()`.

## Erreurs

- **Erreurs UI** : toast Alpine. Jamais d'`alert()`.
- **Erreurs techniques** : `console.error('[MODULE] ...', { detail })`, jamais exposées à l'utilisateur (générique "Erreur interne").
- **Pattern try/catch** sur tout appel externe (Supabase, Claude API).

## Git

- **Naming branches** : pas de branche par sprint au MVP (single-user). Commits directs sur `main`.
- **Push & merge autonomes en clôture** : une fois la clôture déclenchée par Pierre (« c'est bon / validé / nickel / clôture » ou équivalent), CC exécute la séquence git complète — `add` / `commit` / `push`, et `merge` sur `main` si une branche existe — en autonomie, sans redemander confirmation commande par commande. Le déclencheur de clôture vaut autorisation pour toute la séquence.
- **Commits descriptifs en français**, conventional commits : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `security:`.
- **Pas de `git push` pendant upload actif** (règle générale Pierre — applicable Sprint 2+) — seule réserve qui subsiste à l'autonomie ci-dessus.
- **Co-Authored-By** obligatoire sur les commits Claude Code.

## Storage

- **`galactus-input`** : originaux uploadés (images, PDFs).
- **`galactus-output`** : PDFs renommés selon convention `YYYY-MM-DD_slug_TTC_cat_act.pdf`.
- **Plus de cohabitation avec `justificatifs-frais`** après Sprint 0 (legacy en backup 3 mois, drop 2026-08-22).
- **Buckets privés** : utiliser `sb.storage.from(bucket).createSignedUrl(...)` Sprint 3+ pour servir les images.

## Domaines

- **Prod cible** : `galactus.tdmstudio.fr` (cohérent `jarvis.tdmstudio.fr`).
- **PAS** `galactus.tdm.studio` (domaine fictif dans les wireframes — voir PROJET_galactus.md ERREURS CONNUES).

## Hash de déduplication

- **SHA-256** (Web Crypto SubtleCrypto). La colonne DB `pieces.hash_md5` conserve son nom legacy mais contient en réalité du SHA-256. Voir `galactus-decisions.md` entrée 4.
