# Erreurs connues — galactus

Registre transverse des erreurs connues, contournements et dettes acceptées sur le projet galactus. Complète la section ERREURS CONNUES de `PROJET_galactus.md`.

Convention : **P1** = critique (bloque la prod), **P2** = important (à fixer prochain sprint dédié), **P3** = dette mineure / informationnel.

---

## P1 — Critique

### RLS désactivée sur 39 tables Supabase (2026-05-22)

- **Symptôme** : advisory critique Supabase, scan multi-projets.
- **Cause racine** : projet `eqlofgcravaihvfaysdb` mutualisé entre outils TDM (vumedia, transformers, jarvis, lor, frais-tournage→galactus, frise-postprod). Aucune table n'a de Row Level Security activée.
- **Impact** : si un utilisateur tiers obtient la clé anon, il peut lire/écrire toutes les pièces de tous les projets.
- **Contournement Sprint 2** : single-user (compte Pierre), clé anon Supabase non publiée. Pas démarrer prod galactus sans RLS.
- **Fix prévu** : Sprint sécu RLS parallèle S23-24 (brief séparé). À activer **avant** le CNAME `galactus.tdmstudio.fr` (Sprint 5).
- **Récurrent** : N/A (advisory persistant tant que sprint sécu non fait).

---

## P2 — Important

### ✅ RÉSOLU — Étiquette menteuse panneau « File OCR » (2026-05-31)

- **Symptôme** : le panneau droit de `#/ingestion` desktop affichait « Liste des pièces en cours · alimentée Sprint 3 » alors que rien ne l'alimentait (Sprint 3 a livré `#/pieces`/`#/dashboard`, pas ce panneau interne).
- **Cause racine** : stub Sprint 2 (panel File OCR, §4.1) avec un renvoi en avant jamais honoré.
- **Fix appliqué** : relabel honnête → « File de validation en série · à venir (Sprint 4) » (Sprint 3.1, 2026-05-31), bump SW `galactus-v3-sprint3.1`.
- **Backlog** : câbler le panneau File OCR (liste pièces en cours / file de validation + bouton « Valider en série ») — **Sprint 4**, recoupe la queue mini-rafale. Voir `galactus-decisions.md` entrée 35.
- **Récurrent** : non.

### HEIC iPhone non supporté (2026-05-26)

- **Symptôme** : Pierre prend une photo de facture avec iPhone récent, l'upload échoue ou produit un fichier illisible côté `pdf-lib`.
- **Cause racine** : iPhone iOS 11+ enregistre les photos en HEIC par défaut. La lib `pdf-lib` ne sait pas lire HEIC, et `image/heic` n'est pas dans le `accept` de l'input file Sprint 2.
- **Contournement** : Pierre bascule **Réglages iPhone > Appareil photo > Formats > "Le plus compatible"** une fois pour toutes. Ses photos seront en JPG automatiquement. La qualité OCR n'est pas dégradée pour autant (Sonnet 4.6 vision identique sur JPG vs HEIC).
- **Comportement actuel** : input `accept="image/jpeg,image/png,application/pdf"` rejette HEIC silencieusement côté sélecteur fichier (sur certains navigateurs). Si HEIC slip-through (drag&drop, navigateur permissif), `handleFiles` détecte via extension/MIME et toast "Format non supporté : … Active JPG dans Réglages iPhone > Appareil photo > Formats."
- **Fix prévu** : aucun in-app Sprint 2-4. Si futur besoin (autres utilisateurs, partage), ajouter `heic2any` UMD CDN dans `index.html` + conversion préalable dans `js/ingestion.js::pushPage()`. Voir `galactus-decisions.md` entrée 15.
- **Récurrent** : non (one-shot setting iOS).

### Bucket legacy `justificatifs-frais` à drop (2026-05-22)

- **Symptôme** : bucket Supabase `justificatifs-frais` toujours présent après migration vers `galactus-input`/`galactus-output` Sprint 0.
- **Cause racine** : Sprint 0 a conservé volontairement le bucket legacy 3 mois comme backup pour rollback éventuel.
- **Contournement** : aucun, c'est un TODO planifié.
- **Fix prévu** : **drop bucket le 2026-08-22** via dashboard Supabase Storage si aucun rollback effectué. Migration inverse dispo dans `supabase/migrations/06_update_justificatif_urls_to_galactus_input.sql`.
- **Récurrent** : N/A.

---

## P3 — Dette mineure / informationnel

### ✅ RÉSOLU — Colonne `pieces.hash_md5` contenait du SHA-256 (2026-05-26 → soldé 2026-05-29)

- **Symptôme** : nom de colonne trompeur. Lecture de schéma DB suggérait MD5 alors que le contenu est SHA-256 hex 64 chars.
- **Cause racine** : Web Crypto SubtleCrypto n'expose pas MD5 (Sprint 0 décision 4). Le nom `hash_md5` était hérité de `frais_tournage` legacy.
- **Fix appliqué (Sprint 3)** : `ALTER TABLE pieces RENAME COLUMN hash_md5 TO hash_sha256` (migration `20260529181525`). `js/supabase.js::findPieceByHash` et le payload INSERT de `js/ingestion.js` mis à jour. Voir `galactus-decisions.md` entrée 31.
- **Récurrent** : N/A (dette soldée).

### Warning console Tailwind CDN (2026-05-22)

- **Symptôme** : console browser affiche `cdn.tailwindcss.com should not be used in production` à chaque page load.
- **Cause racine** : Sprint 1 utilise Tailwind CDN (~1.5 MB) sans build step pour rester en MVP single-user.
- **Contournement** : service worker cache shell absorbe la lib après 1ʳᵉ visite. Coût payé une fois.
- **Fix prévu** : Sprint 5+ si perf devient un problème — migration Tailwind CLI précompilé via `npx tailwindcss -i ... -o css/tailwind.compiled.css --watch` + remplacer `<script src="cdn.tailwindcss.com">` par `<link rel="stylesheet" href="css/tailwind.compiled.css">`. Voir `galactus-decisions.md` entrée 10.
- **Récurrent** : oui (visible à chaque ouverture console).

### Wireframes affichent domaine `galactus.tdm.studio` (faux) (2026-05-22)

- **Symptôme** : maquettes Claude Design dans `design-handoff/` mentionnent `galactus.tdm.studio` comme domaine cible.
- **Cause racine** : erreur de transcription dans le brief Claude Design 2026-05-21. Le vrai domaine prod est `galactus.tdmstudio.fr` (cohérent `jarvis.tdmstudio.fr`).
- **Contournement** : documenté dans `PROJET_galactus.md`, `galactus-conventions.md`. Ne pas s'aligner sur les wireframes pour ce point.
- **Fix prévu** : N/A (information).
- **Récurrent** : N/A (documentation).

### PWA icons = placeholders Pillow Python (2026-05-22)

- **Symptôme** : icônes 192/512 px générées par script Python (`icons/_generate.py`) = gradient cosmos + lettre G blanche.
- **Cause racine** : pas d'asset designer disponible Sprint 1.
- **Contournement** : placeholders respectent palette cosmic + lettre G iconique. Suffisant pour MVP single-user.
- **Fix prévu** : Sprint 5 polish — remplacement par asset designer dédié (Pierre commande / produit).
- **Récurrent** : N/A.

### PDF chiffrés / protégés par mot de passe non supportés (2026-05-26)

- **Symptôme** : Pierre upload un PDF protégé (souvent les factures bancaires, certaines factures BTP), `buildPdfFromPages` plante au `PDFDocument.load`. Toast "PDF protégé non supporté".
- **Cause racine** : `pdf-lib@1.17.1` ne sait pas ouvrir un PDF avec password. Par défaut `ignoreEncryption: false` → throw.
- **Contournement** : Pierre déprotège manuellement via Aperçu macOS : Fichier > Exporter > décocher "Chiffrer". Puis re-upload. Toast donne le mode d'emploi.
- **Fix prévu** : si volume devient gênant, intégrer un input mot de passe optionnel dans la subview home (`pages.length > 0`). Improbable Sprint 3-4 (occurrence rare au volume Pierre).
- **Récurrent** : potentiellement, selon types de fournisseurs (loueur immobilier, banque, EDF…).

### ✅ RÉSOLU — Édition impossible pendant le mode rafale Sprint 2 (2026-05-26 → 2026-05-29)

- **Symptôme** : Pierre valide une rafale, repère une erreur sur une pièce passée, pas de back Sprint 2.
- **Cause racine** : la vue Pièces (`#/pieces`) n'était qu'un placeholder Sprint 2.
- **Fix appliqué (Sprint 3)** : vue Pièces + modal édition complète → rectification après coup de n'importe quelle pièce (y compris ingérée en rafale), avec recompose du nom de fichier si donnée clé.
- **Récurrent** : non (résolu).

### 🟡 PARTIEL — Bouton "Créer quand même" du modal doublon (2026-05-26 → migration faite 2026-05-29)

- **Symptôme** : bouton "Créer quand même" grisé dans le modal doublon.
- **Cause racine** : contrainte `UNIQUE (hash_md5)` ferait planter l'INSERT si force-create.
- **Fix appliqué (Sprint 3, partiel)** : migration DB faite — `hash_collision_n int DEFAULT 0` + `DROP pieces_hash_md5_key` + `ADD UNIQUE (hash_sha256, hash_collision_n)` (`20260529181525`). **Reste à faire (Sprint 3.5)** : la logique JS (`hash_collision_n = max(...)+1` si force-create) dans `ingestion.js` — hors-scope Sprint 3 (vues Pièces/Dashboard). Le bouton reste disabled jusque-là. Voir `galactus-decisions.md` entrée 31.
- **Récurrent** : non (cas rare : factures montants identiques, dates différentes).

### ✅ RÉSOLU — `justificatif_url` = URL signée 1h périmée (finding B, 2026-05-29)

- **Symptôme** : previews de justificatif mortes après 1h (URL signée stockée en base).
- **Fix appliqué (Sprint 3)** : colonne `justificatif_path` (chemin storage) + signature à la volée (`signJustificatif`). Backfill des 14 legacy. `ingestion.js` écrit le chemin capturé, plus jamais d'URL signée stockée. Voir `galactus-decisions.md` entrée 30.
- **Récurrent** : non.

### ✅ RÉSOLU — `listFournisseursRecurrents()` triait sur colonne inexistante (2026-05-29)

- **Symptôme** : bug latent — `.order('nom_canonique')` aurait renvoyé un 400 (la colonne réelle est `nom`). Masqué jusqu'ici car la table était vide.
- **Cause racine** : nom de colonne erroné dans le helper `js/supabase.js`.
- **Fix appliqué (Sprint 3)** : `.order('nom')`. Détecté au moment du seed des 6 fournisseurs (qui rendait le tri effectif).
- **Récurrent** : non.

### Token GitHub `ghp_k498...` était exposé dans `.git/config` legacy (2026-05-22)

- **Symptôme** : Sprint 0 a découvert un token PAT dans `.git/config` de l'ancien repo `TDMstudio-frais-tournage`.
- **Cause racine** : remote configurée en HTTPS avec token embédé.
- **Contournement** : remote reconfigurée en SSH Sprint 0 + token révoqué côté GitHub par Pierre le 2026-05-22.
- **Fix prévu** : N/A (fixé).
- **Récurrent** : non.

---

## Stack transverse Pierre (référence)

Pour les erreurs récurrentes liées aux composants de stack (Supabase contraintes CHECK silencieuses 400, Alpine reactivity nested objects, etc.), voir `~/pierre-brain/pilotage/erreurs-connues-stack.md` côté vault (transverse à tous les projets Pierre).
