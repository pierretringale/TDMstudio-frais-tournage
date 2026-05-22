# PROJET_galactus — Outil compta interne TDM studio + vu.media

## ÉTAT ACTUEL — à lire en premier

| Élément | État |
|---|---|
| Phase | Sprint 0 terminé (2026-05-22) |
| Prochaine étape | Sprint 1 — UI shell + navigation + auth + PWA (~3h) |
| Bloquant | Action manuelle Pierre : config Supabase Auth (JWT 30j + Site URLs) via dashboard |
| À NE PAS FAIRE | Pas React (Alpine.js + Tailwind seulement). Pas d'appel direct Indy (pas d'API publique). Pas multi-user. RLS hors-scope galactus mais critique en sprint sécu parallèle S23-24. Suffixe activité (TDM/VUM/MIX) obligatoire sur chaque pièce. JWT TTL 30 jours. Pas de git push pendant upload actif. 5 catégories CHECK figées (`fournisseur`, `ndf`, `materiel`, `ndf-mois`, `vente`). Charte TDM v1.1 PAS applicable, palette cosmic libre. Pas de quote-part TVA fine (Indy s'en charge). Pas de framework de composants lourd, Tailwind utility classes inline. |
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
| Auth | Supabase Auth, compte Pierre unique, JWT TTL 30 jours | Single-user, refresh peu fréquent souhaité |
| Storage | 2 buckets : `galactus-input` (originaux), `galactus-output` (PDFs renommés) | Bucket `justificatifs-frais` legacy conservé 3 mois en backup |
| Edge Functions | 4 Deno : `analyze-receipt` (OCR Claude), `generate-monthly-export`, `generate-ndf-mois`, `generate-pre-ca3` | Sprint 0 : `analyze-receipt` rapatriée. Sprint 2-4 : extensions + nouvelles |
| Modèle Claude API | `claude-sonnet-4-6` | Équilibre coût/qualité OCR factures, ~$0.01/pièce |
| Déploiement | GitHub Pages (`main` branch root) | Suffisant MVP. CNAME `galactus.tdmstudio.fr` Sprint 5 (action Pierre Squarespace) |

## CONTRAINTES MÉTIER / PLATEFORME

- **5 catégories CHECK** : `fournisseur`, `ndf`, `materiel`, `ndf-mois`, `vente`. Figées schéma Sprint 0.
- **3 activités CHECK** : `TDM`, `VUM`, `MIX`. Suffixe obligatoire sur chaque pièce pour analytique Indy.
- **5 statuts CHECK** : `a_traiter`, `traite`, `uploade_indy`, `consolide_dans_ndf_mois`, `archive`. Workflow : a_traiter → traite → uploade_indy (manuel) / consolide_dans_ndf_mois → archive.
- **Convention nom de fichier** : `YYYY-MM-DD_fournisseur-slug_montantTTC_categorie_[TDM|VUM|MIX].pdf` (toujours .pdf en sortie, consolidation multi-pages côté Edge Function).
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

À remplir Sprint 1.

## CAS LIMITES IDENTIFIÉS

À remplir au fil des sessions.

## JOURNAL DES DÉCISIONS TECHNIQUES

Voir `galactus-decisions.md` (journal append-only).

## ERREURS CONNUES / À NETTOYER

| Date | Symptôme / Sujet | Cause racine | Fix appliqué | Récurrent |
|---|---|---|---|---|
| 2026-05-22 | ⚠️ Wireframes affichent domaine `galactus.tdm.studio` | Source : maquettes Claude Design (`design-handoff/`). Le vrai domaine prod est `galactus.tdmstudio.fr` (cohérent `jarvis.tdmstudio.fr`). Ne pas s'aligner sur les wireframes pour ce point. | Documenté ici + dans `galactus-conventions.md`. | N/A (documentation) |
| 2026-05-22 | 🗑️ Bucket `justificatifs-frais` à drop | Migration legacy → `galactus-input` faite Sprint 0. Bucket legacy conservé 3 mois en backup pour rollback éventuel. | À drop le **2026-08-22** si aucun rollback nécessaire. | N/A (TODO planifié) |
| 2026-05-22 | ⚠️ Warning console Tailwind CDN attendu Sprint 1 | `cdn.tailwindcss.com should not be used in production`. Connu, accepté MVP single-user. | Documenter quand Sprint 1 lancera l'app. Migration Tailwind CLI précompilé prévue Sprint 5+ si perf devient un problème. | N/A |
| 2026-05-22 | ⚠️ Token GitHub `ghp_k498...` était exposé dans `.git/config` legacy | Remote HTTPS avec token embédé sur l'ancien repo. | Remote reconfigurée en SSH Sprint 0 (plus de token dans `.git/config`). **Pierre doit révoquer le token côté GitHub** (Settings → Developer settings → PAT) si pas encore fait. | Non |
| 2026-05-22 | ⚠️ Advisory critique Supabase : 39 tables sans RLS | Connu depuis session pilotage. Hors-scope galactus. | Sprint sécu RLS parallèle S23-24 (brief séparé). Ne pas démarrer prod galactus sans. | N/A |
