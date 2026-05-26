# Mémoire galactus

Sprint 1 terminé le 2026-05-22 — UI shell + nav 4 vues + auth Pierre + PWA installable.

## État courant

- ✅ Sprint 0 : repo modulaire, DB Supabase migrée (table `pieces` + `fournisseurs_recurrents`), 2 buckets Storage, 14 lignes legacy migrées
- ✅ Sprint 1 : `index.html` shell + Tailwind config inline + `css/galactus.css` + `js/{utils,supabase,app}.js`, sidebar desktop (nebula + étoiles + halo logo), tab bar mobile (Ingestion pill proéminent), 4 vues vides accessibles, page démo `#/_demo` (14 sections design system), login overlay Pierre, manifest + service-worker (cache shell + offline fallback), 2 icons PWA générées
- 🟡 Sprint 2 prochain : vue Ingestion fonctionnelle (caméra mobile + fichier desktop), Edge Function `analyze-receipt` étendue, loader vortex animé, validation post-OCR avec confidence badges

## Références

- `PROJET_galactus.md` — état courant + contraintes inviolables (NE PAS FAIRE)
- `galactus-decisions.md` — journal décisions techniques append-only (12 entrées Sprint 0 + 1)
- `galactus-conventions.md` — patterns techniques figés (pattern LotR Supabase, ES2022, Alpine root, hash routing)
- `docs/DESIGN.md` — palette 20 couleurs, fonts, tokens cosmiques, composants Tailwind
- `docs/CONVENTIONS.md` — conventions métier (nom fichier, 5 catégories, 3 activités, 5 statuts, 3 sources)

## Démarrer en local

```bash
python3 -m http.server 8000
# Ouvrir http://localhost:8000
# Login : compte Pierre Supabase existant
# Page démo composants : http://localhost:8000/#/_demo
```
