# PROJET_galactus — Outil compta interne TDM studio + vu.media

## ÉTAT ACTUEL — à lire en premier

| Élément | État |
|---|---|
| Phase | **Sprint 3 livré & validé (2026-05-29)** — vues **Pièces** + **Dashboard** fonctionnelles sur la vraie DB (14 legacy + suppression testée OK). Migrations appliquées : `justificatif_path` (signature à la volée, fin du lien mort 1h), dette `hash_md5`→`hash_sha256` soldée, `hash_collision_n` + UNIQUE composite. 6 fournisseurs récurrents seedés. |
| Prochaine étape | **Sprint 3.5** : réactiver le bouton "Créer quand même" du modal doublon (la migration `hash_collision_n` est faite, reste la logique `ingestion.js`). Câbler `derniere_facture_date` à l'ingestion sur match de slug (réveille les alertes récurrents, aujourd'hui dormantes). Puis **Sprint 4** — Vue Exports + 3 Edge Functions. |
| Bloquant | Aucun. Test 2 (OCR photo iPhone end-to-end) toujours différé : à valider une fois galactus servi en HTTPS (crypto.subtle requiert un secure context — cf ERREURS CONNUES). Sprint sécu RLS 39 tables avant prod données compta. |
| À NE PAS FAIRE | Pas React (Alpine.js + Tailwind seulement). Pas d'appel direct Indy (pas d'API publique). Pas multi-user. RLS hors-scope galactus mais critique en sprint sécu parallèle S23-24. Suffixe activité (TDM/VUM/MIX) obligatoire sur chaque pièce. Pas de git push pendant upload actif. 5 catégories CHECK figées (`fournisseur`, `ndf`, `materiel`, `ndf-mois`, `vente`). Charte TDM v1.1 PAS applicable, palette cosmic libre. Pas de quote-part TVA fine (Indy s'en charge). Pas de framework de composants lourd, Tailwind utility classes inline. |
| URL | GitHub Pages temporaire (`pierretringale.github.io/galactus`) — domaine prod cible : `galactus.tdmstudio.fr` (CNAME Squarespace, Sprint 5) |
| Repo GitHub | `pierretringale/galactus` (renommé depuis `TDMstudio-frais-tournage` le 2026-05-22) |
| Project Supabase | `eqlofgcravaihvfaysdb` (mutualisé entre projets TDM, conventions préfixes `vm_*`, `pp_*`, `lor_*`, `trf_*` — galactus utilise `pieces` + `fournisseurs_recurrents` sans préfixe) |

## OBJECTIF DU PROJET

Galactus = outil compta interne TDM studio + vu.media. Single-user (Pierre dilettante en compta). Sa mission : ranger les flux financiers, guider Pierre dans Indy (upload manuel), calculer les remboursements (NDF mensuelle), fluidifier et automatiser. 5 catégories × 3 activités (TDM/VUM/MIX). PWA mobile-first installable iPhone.

## STACK TECHNIQUE

| Composant | Choix | Raison |
|---|---|---|
| Runtime client | Browser (HTML5) | PWA mobile-first, pas de serveur Node |
| Framework UI | **Alpine.js CDN** + **Tailwind CDN** | Zéro build step, MVP single-user, prototype rapide. Pas React — Stack figée session design 2026-05-21 |
| Fonts | Inter / Big Shoulders Display / JetBrains Mono | Inter body / Display titres uppercase / Mono data + filenames |
| DB | **Supabase Postgres** (project `eqlofgcravaihvfaysdb`) | Mutualisé avec autres outils TDM, MCP intégré pour migrations |
| Auth | Supabase Auth, compte Pierre unique, défauts Free plan (JWT 1h + refresh token rotating auto) | Single-user, lib `supabase-js` rafraîchit le JWT en arrière-plan, pas de relogin visible. Voir `galactus-decisions.md` entrée 9 |
| Storage | 2 buckets : `galactus-input` (originaux), `galactus-output` (PDFs renommés) | Bucket `justificatifs-frais` legacy conservé 3 mois en backup |
| Edge Functions | 4 Deno : `analyze-receipt` (OCR Claude), `generate-monthly-export`, `generate-ndf-mois`, `generate-pre-ca3` | Sprint 0 : `analyze-receipt` rapatriée. Sprint 2-4 : extensions + nouvelles |
| Modèle Claude API | `claude-sonnet-4-6` | Équilibre coût/qualité OCR factures, ~$0.01/pièce |
| Déploiement | GitHub Pages (`main` branch root) | Suffisant MVP. CNAME `galactus.tdmstudio.fr` Sprint 5 (action Pierre Squarespace) |

## CONTRAINTES MÉTIER / PLATEFORME

- **5 catégories CHECK** : `fournisseur`, `ndf`, `materiel`, `ndf-mois`, `vente`. Figées schéma Sprint 0.
- **3 activités CHECK** : `TDM`, `VUM`, `MIX`. Suffixe obligatoire sur chaque pièce pour analytique Indy.
- **5 statuts CHECK** : `a_traiter`, `traite`, `uploade_indy`, `consolide_dans_ndf_mois`, `archive`. Workflow : a_traiter → traite → uploade_indy (manuel) / consolide_dans_ndf_mois → archive.
- **Convention nom de fichier** : `YYYY-MM-DD_fournisseur-slug_montantTTC_categorie_[TDM|VUM|MIX].pdf` (toujours .pdf en sortie ; consolidation multi-pages **côté client** via pdf-lib — pas Edge Function ; montantTTC avec **point** décimal depuis 2026-05-29, ex. `6.00`, CSV-safe pour exports Indy).
- **Single-user** : compte Pierre unique, RLS hors-scope ce sprint.
- **Pas d'API Indy** : workflow upload manuel guidé en 3 étapes (Sélection → ZIP → confirmer).
- **Pas de quote-part TVA fine** : galactus stocke HT/TVA/TTC séparés + activité, Indy gère la règle comptable.
- **Refacturations dans assistant NDF** : internet 24€/mois (80% de 29,99) + téléphone 8€/mois (50% de 15,99). IK et loyer Clélia = brief séparé outil-remboursements.
- **Hash de déduplication** : SHA-256 (Web Crypto SubtleCrypto n'expose pas MD5 — voir `galactus-decisions.md` entrée 4).

## STRUCTURE DU PROJET

```
galactus/
├── PROJET_galactus.md, MEMORY.md, galactus-decisions.md, galactus-conventions.md
├── README.md, .gitignore, .env.example
├── index.html, manifest.json, service-worker.js          # Sprint 1
├── icons/                                                 # Sprint 1
├── css/galactus.css                                       # Sprint 1
├── js/{app,supabase,utils}.js                             # Sprint 1
├── js/{ingestion,pieces,dashboard,exports}.js             # Sprints 2-4
├── supabase/
│   ├── functions/analyze-receipt/index.ts                 # Sprint 0 (rapatrié) → étendu Sprint 2
│   └── migrations/202605221*.sql                          # 6 fichiers Sprint 0
├── archive/{index-legacy-frais-tournage.html, icon-legacy.png}
├── design-handoff/                                        # gitignored
└── docs/{DESIGN,CONVENTIONS}.md                           # Sprint 1
```

## FONCTIONS / ROUTES ACTIVES

| Route / Élément | Description | État | Sprint |
|---|---|---|---|
| `#/ingestion` (défaut) | Vue Ingestion bout en bout : capture/drop → OCR → validation → INSERT pieces + uploads buckets. Écrit désormais `justificatif_path` (chemins capturés, plus d'URL signée stockée) | ✅ Actif | Sprint 2 / 3 |
| Panneau « File OCR » (`#/ingestion` desktop) | Colonne droite 340px, sous-vue home. Stub `placeholder-striped` relabellé « File de validation en série · à venir (Sprint 4) » (Sprint 3.1). Câblage réel (liste pièces en cours / file de validation + « Valider en série ») reporté Sprint 4 (recoupe queue mini-rafale) | 🟡 Stub | Sprint 4 |
| `#/dashboard` | 5 KPI (CA YTD, dépenses TDM/VUM + delta M-1, à uploader Indy, NDF mois) + bannière TVA/Pré-CA3 (MIX « à ventiler ») + fournisseurs récurrents (alertes) + graphes SVG vanilla (barres 12 mois stacked, camembert année). Clic KPI → Pièces pré-filtrée | ✅ Actif | Sprint 3 |
| `#/pieces` | Tableau desktop / cards mobile, filtres+tri **serveur** (recherche, catégorie/activité/statut multi, période, payé), footer totaux sticky, sélection multiple + 3 actions groupées (uploadé Indy, catégorie masse, suppression), modal édition (recompose `nom_fichier_normalise` DB-only, warning Indy, « Voir » justificatif signé à la volée), suppression ligne+fichiers | ✅ Actif | Sprint 3 |
| `#/exports` | Vue Exports (placeholder striped) | 🟡 Stub | Sprint 4 |
| Helpers `supabase.js` Sprint 3 | `listPieces` enrichi (multi-`in`, recherche `or.ilike` sanitizée, payé, tri serveur), `signJustificatif`, `bulkUpdatePieces` (`.select()`), `supprimerPieceComplete` (fichiers+ligne) | ✅ Actif | Sprint 3 |
| Edge Function `analyze-receipt` **v5** | OCR multi-pages Claude Sonnet 4.6, schéma enrichi. v5 (2026-05-29) : `reference_fournisseur` conditionnelle (facture formelle + n° préfixé + récurrent/≥100€ + conf≥0.7, verbatim), `description` forcée FR, hint Anthropic→MIX. max_tokens 2500 | ✅ Actif | Sprint 2 / 2.5 |
| Boutons "Annuler" ingestion | Staging (vide les pages) + écran validation (abandonne la pièce + sort de rafale). Réutilisent `resetForm()` | ✅ Actif | Sprint 2.5 |
| Subview rafale | Mode rafale Pierre (compteur ascendant, tab bar masquée via `Alpine.store('app').rafaleMode`) | ✅ Actif | Sprint 2 |
| Modal doublon | Détection hash SHA-256 + carte d'identité pièce existante. "Voir dans Pièces" **réactivé** (nav + pré-filtre fournisseur). "Créer quand même" reste disabled → Sprint 3.5 (logique `ingestion.js`) | ✅ Actif (limité) | Sprint 2 / 3 |
| Vortex loader OCR | Overlay plein écran `#0b0a14` + 4 anneaux concentriques multi-vitesses + doc avalé + barre progression | ✅ Actif | Sprint 2 |
| FilenamePreview live | Background ink + 5 segments colorés mono mis à jour à chaque keystroke (Alpine x-text) | ✅ Actif | Sprint 2 |
| `#/_demo` | Page démo Design System (cachée nav, référence visuelle pérenne) | ✅ Actif | Sprint 1 |
| Login overlay | Auth Supabase compte Pierre unique (email + password) | ✅ Actif | Sprint 1 |
| Sidebar desktop (≥768px) | Nebula + étoiles + halo logo + 4 nav items | ✅ Actif | Sprint 1 |
| Tab bar mobile (<768px) | 4 entrées + Ingestion en pill magenta proéminent | ✅ Actif | Sprint 1 |
| Service Worker | Cache shell + network-first Supabase + offline fallback HTML | ✅ Actif | Sprint 1 |
| Manifest PWA | Installable iPhone (Add to Home Screen), standalone, theme #ff1f6d | ✅ Actif | Sprint 1 |
| Toast system | Stack bottom-right, types info/success/error/warning, auto-dismiss 4s | ✅ Actif | Sprint 1 |

## CAS LIMITES IDENTIFIÉS

| Cas | Comportement attendu | Sprint identifié |
|---|---|---|
| Photo iPhone HEIC | Refusée côté input (accept restrictif `image/jpeg,image/png`). Toast guide Pierre vers Réglages iOS > Appareil photo > Formats > "Le plus compatible". | Sprint 2 |
| PDF protégé/chiffré | `pdf-lib` plante au `PDFDocument.load`. Catch → toast "PDF protégé non supporté, déprotège via Aperçu macOS (Fichier > Exporter > sans mot de passe)". Pas d'INSERT, pas d'upload. | Sprint 2 |
| CDN `unpkg.com/pdf-lib` down | `window.PDFLib` undefined → `buildPdfFromPages` throw. Toast "Service de conversion PDF indisponible, réessayer dans quelques minutes". Pas d'INSERT car erreur avant. | Sprint 2 |
| Quota Anthropic API (429) | Edge Function retourne `{ error: 'quota_exceeded' }`. Client détecte code, toast "Quota OCR dépassé temporairement, réessaie dans quelques minutes". Sub-view revient à `home`. | Sprint 2 |
| OCR JSON malformé | Fallback Edge Function : `confiance_ocr=0`, `confidence_per_field={...:0}`, `ocr_text_brut=raw`. Tous les fields en border rouge `field-conf-low`, Pierre remplit à la main. | Sprint 2 |
| Drop multi-fichiers desktop | Modal de choix "même pièce / pièces séparées". Sprint 2 : "séparées" traite la 1ʳᵉ + toast. Sprint 3 : queue mini-rafale prévue. | Sprint 2 / Sprint 3 |
| Hash UNIQUE collision après modal doublon | Sprint 2 : boutons "Créer quand même" / "Voir détail" du modal sont **disabled** (cosmétiques). Si insert tente collision via une autre source → toast "Doublon strict refusé". | Sprint 2 / Sprint 3 |
| Édition pendant rafale | Impossible Sprint 2 — Pierre se trompe à la pièce N en rafale, pas de back. Toast info au démarrage rafale. Édition disponible Sprint 3 via vue Pièces. | Sprint 2 / Sprint 3 |
| Upload bucket échoue après INSERT OK | Pièce reste en DB avec `justificatif_url='pending'`, pas d'orphelin fichier. Sprint 3 : bouton "Réuploader justificatif" dans modal édition. | Sprint 2 / Sprint 3 |
| Accès en HTTP non sécurisé (IP LAN type `http://192.168.x.x`) | `crypto.subtle` indisponible hors secure context → garde dans `startOCR` : toast clair + abort, pas de crash. PROD = HTTPS donc OK. Test iPhone local : passer par tunnel HTTPS. | Sprint 2.5 |
| `justificatif_path` NULL (pièce non backfillée ou upload échoué) | `signJustificatif` renvoie null → vignette/preview = placeholder "justificatif indisponible", pas de crash. | Sprint 3 |
| Justificatif servi après > 1h de session | Plus de lien mort : on **signe à la volée** au clic/ouverture (jamais d'URL signée stockée). | Sprint 3 |
| Suppression : fichier storage déjà absent | `supprimerPieceComplete` log le warning mais ne bloque pas la suppression DB (best-effort). Bucket legacy `justificatifs-frais` jamais touché. | Sprint 3 |
| Filtre "payé" hors contexte | Grisé/inactif tant que `categorie=fournisseur` n'est pas dans la sélection (réinitialisé si fournisseur quitte la sélection). | Sprint 3 |
| Édition d'une donnée clé | Recompose `nom_fichier_normalise` en base ; **`justificatif_path` inchangé** (rename physique du PDF différé à l'export Sprint 4). Warning jaune si pièce déjà `uploade_indy`. | Sprint 3 |
| Alertes fournisseurs récurrents dormantes | `derniere_facture_date` jamais écrite en Sprint 3 (seed NULL, ingestion = finding B seul) → les 6 restent "jamais ingéré". Câblage = backlog Sprint 3.5. | Sprint 3 |
| Anti-double-comptage NDF | Déductible = `ndf` non consolidés **+** `ndf-mois` (ensembles disjoints). Aucun `ndf-mois` n'existe avant Sprint 4 → déductible = Σ `ndf` du mois. | Sprint 3 |
| Graphes SVG via Alpine | `x-for` ne crée pas les nœuds dans le namespace SVG → SVG généré en **chaîne JS** injectée via `x-html`. Camembert : `circle` plein si une seule activité (≥99,9 %). | Sprint 3 |

## JOURNAL DES DÉCISIONS TECHNIQUES

Voir `galactus-decisions.md` (journal append-only).

## ERREURS CONNUES / À NETTOYER

| Date | Symptôme / Sujet | Cause racine | Fix appliqué | Récurrent |
|---|---|---|---|---|
| 2026-05-22 | ⚠️ Wireframes affichent domaine `galactus.tdm.studio` | Source : maquettes Claude Design (`design-handoff/`). Le vrai domaine prod est `galactus.tdmstudio.fr` (cohérent `jarvis.tdmstudio.fr`). Ne pas s'aligner sur les wireframes pour ce point. | Documenté ici + dans `galactus-conventions.md`. | N/A (documentation) |
| 2026-05-22 | 🗑️ Bucket `justificatifs-frais` à drop | Migration legacy → `galactus-input` faite Sprint 0. Bucket legacy conservé 3 mois en backup pour rollback éventuel. | À drop le **2026-08-22** si aucun rollback nécessaire. | N/A (TODO planifié) |
| 2026-05-22 | ⚠️ Warning console Tailwind CDN | `cdn.tailwindcss.com should not be used in production`. Connu, accepté MVP single-user (~1.5 MB charge initiale mobile, mais cache PWA absorbe après 1er load). | Documenté et présent en prod Sprint 1. Migration Tailwind CLI précompilé prévue Sprint 5+ si perf devient un problème. Voir `galactus-decisions.md` entrée 10. | N/A |
| 2026-05-22 | ⚠️ Token GitHub `ghp_k498...` était exposé dans `.git/config` legacy | Remote HTTPS avec token embédé sur l'ancien repo. | Remote reconfigurée en SSH Sprint 0 (plus de token dans `.git/config`). **Token révoqué côté GitHub le 2026-05-22 par Pierre.** | Non |
| 2026-05-22 | ⚠️ Advisory critique Supabase : 39 tables sans RLS | Connu depuis session pilotage. Hors-scope galactus. | Sprint sécu RLS parallèle S23-24 (brief séparé). Ne pas démarrer prod galactus sans. | N/A |
| 2026-05-26 | 📐 Dette : colonne `pieces.hash_md5` contient en réalité du SHA-256 | Web Crypto SubtleCrypto n'expose pas MD5 (Sprint 0 décision 4). Nom de colonne conservé pour éviter migration Sprint 2. | À renommer un jour `hash_sha256` ou `fichier_hash` via migration mineure (Sprint 3+). | N/A (dette acceptée) |
| 2026-05-26 | ⚠️ HEIC iPhone non supporté | `pdf-lib` ne lit pas HEIC. Format par défaut iPhone récent. | Restriction input `accept="image/jpeg,image/png,application/pdf"`. Pierre doit basculer Réglages iPhone > Appareil photo > Formats > "Le plus compatible". Documenté dans `docs/gouvernance/erreurs-connues.md`. | Non |
| 2026-05-26 | ⚠️ PDF chiffrés / protégés non supportés | `pdf-lib.load` plante sur PDF avec password. | Try/catch dans `buildPdfFromPages` → toast clair vers Aperçu macOS. Documenté `docs/gouvernance/erreurs-connues.md`. | Non |
| 2026-05-26 | ⚠️ Édition impossible pendant rafale | Pas de back dans le flow rafale Sprint 2. Si Pierre se trompe à la pièce N, validation forcée puis correction Sprint 3. | Toast info au démarrage rafale. Édition complète Sprint 3 via vue Pièces (modal édition). | Non |
| 2026-05-26 | 📐 Bouton "Créer quand même" du modal doublon = disabled cosmétique | Contrainte UNIQUE sur `hash_md5` planterait l'INSERT. Sprint 2 = bouton désactivé + tooltip "Disponible Sprint 3". | Implémentation fix Sprint 3 via colonne `hash_collision_n` + ALTER UNIQUE → UNIQUE(hash_md5, hash_collision_n). | N/A (dette planifiée) |
| 2026-05-29 | 🔴 Uploads Storage en 400 ("new row violates row-level security policy") — INSERT pieces OK mais `justificatif_url` reste `pending` | Les 8 policies `galactus_*` sur `storage.objects` étaient scopées rôle **`anon`** (héritage frais-tournage sans login). Le Sprint 1 a introduit l'auth Supabase → uploads en rôle **`authenticated`** → aucune policy ne matchait. `pieces` passait car RLS désactivée dessus. | Migration `galactus_storage_policies_to_authenticated` : ALTER POLICY ×8 → `authenticated`. Vérifié : ingestion bout en bout OK. **Leçon : tout ajout d'auth doit re-vérifier les policies storage.** | Non (mais à re-checker si nouveau bucket) |
| 2026-05-29 | ⚠️ `crypto.subtle.digest` → "undefined is not an object" sur iPhone en test local | `crypto.subtle` (Web Crypto) indisponible hors secure context. `http://192.168.x.x` (IP LAN HTTP) n'est pas un secure context ; `localhost` et HTTPS le sont. | Garde défensive dans `startOCR` (`!window.isSecureContext || !crypto.subtle` → toast + abort). Impact PROD nul (GitHub Pages + domaine = HTTPS). Test iPhone local = tunnel HTTPS. | Non |
| 2026-05-29 | 🔴 `justificatif_url` = URL signée 1h → liens preview morts après expiration | Sprint 2 stockait une URL signée expirante en base (finding B test run). | Colonne `justificatif_path` (chemin storage `bucket/objet`) + `signJustificatif()` à la volée. Backfill déterministe des 14 legacy. `ingestion.js` écrit le path capturé (principe d'or), plus jamais d'URL signée stockée. Migration `galactus_sprint3_pieces_dashboard`. | Non |
| 2026-05-29 | 📐 Dette `hash_md5` (contient du SHA-256) — **SOLDÉE** | Voir entrée 2026-05-26. | `ALTER ... RENAME COLUMN hash_md5 TO hash_sha256` (migration Sprint 3). Helpers + `ingestion.js` mis à jour. | N/A (dette soldée) |
| 2026-05-29 | 🟢 Bouton "Créer quand même" — migration DB faite | Voir entrée 2026-05-26. | `hash_collision_n` + `UNIQUE (hash_sha256, hash_collision_n)` appliqués (la contrainte simple bloquait l'INSERT). **Le bouton reste disabled** : logique de collision dans `ingestion.js` = Sprint 3.5. | N/A (dette planifiée) |
| 2026-05-29 | 🐛 `listFournisseursRecurrents()` triait sur `nom_canonique` (colonne inexistante → 400) | Nom de colonne erroné dans le helper (la vraie colonne est `nom`). Latent car la table était vide jusqu'au seed Sprint 3. | Fix `.order('nom')`. | Non |
