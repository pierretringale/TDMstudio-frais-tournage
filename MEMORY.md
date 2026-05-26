# Mémoire galactus

Sprint 2 terminé le 2026-05-26 — vue Ingestion fonctionnelle bout en bout.

## État courant

- ✅ Sprint 0 (2026-05-22) : repo modulaire, DB Supabase migrée (table `pieces` + `fournisseurs_recurrents`), 2 buckets Storage, 14 lignes legacy migrées
- ✅ Sprint 1 (2026-05-22) : `index.html` shell + Tailwind config inline + `css/galactus.css` + `js/{utils,supabase,app}.js`, sidebar desktop (nebula + étoiles + halo logo), tab bar mobile, 4 vues vides accessibles, page démo `#/_demo`, login overlay Pierre, manifest + service-worker, 2 icons PWA
- ✅ Sprint 2 (2026-05-26) : vue Ingestion bout en bout — capture mobile (caméra arrière) / drop desktop, multi-pages, vortex loader OCR plein écran, Edge Function `analyze-receipt` v4 étendue (multi-pages + hint + confidence_per_field + ocr_text_brut), validation post-OCR avec auto-calc HT/TVA/TTC + FilterChip cat 5 / act 3 + select taux TVA 5 options + FilenamePreview live + confidence badges par champ, hash SHA-256 dédup + modal doublon avec carte d'identité, build PDF côté client via pdf-lib UMD, flux INSERT puis uploads parallèles puis UPDATE (évite orphelins), mode rafale via `Alpine.store('app').rafaleMode`, sortie vers `#/pieces`
- 🟡 Sprint 3 prochain (~4h) : Vue Pièces (tableau + filtres + modal édition) + Vue Dashboard (KPI mensuels + bannière TVA + fournisseurs récurrents)

## Références

- `PROJET_galactus.md` — état courant + contraintes inviolables (NE PAS FAIRE) + CAS LIMITES + ERREURS CONNUES
- `galactus-decisions.md` — journal décisions techniques append-only (Sprints 0+1+2)
- `galactus-conventions.md` — patterns techniques figés (pattern LotR Supabase, ES2022, Alpine root, hash routing)
- `docs/DESIGN.md` — palette 20 couleurs, fonts, tokens cosmiques, composants Tailwind
- `docs/CONVENTIONS.md` — conventions métier (nom fichier, 5 catégories, 3 activités, 5 statuts, 3 sources)
- `docs/gouvernance/erreurs-connues.md` — registre transverse des erreurs connues / dette acceptée

## Démarrer en local

```bash
python3 -m http.server 8000
# Ouvrir http://localhost:8000
# Login : compte Pierre Supabase existant
# Page démo composants : http://localhost:8000/#/_demo
```

## Test ingestion Sprint 2

```bash
# Fixtures à préparer dans ~/Desktop/galactus-test-fixtures/ :
#   anthropic_avril.pdf      (facture API Claude, attendu VUM)
#   decathlon_ticket.jpg     (ticket caisse, attendu ndf/TDM)
#   render_invoice.pdf       (taux TVA 0%, attendu VUM)
#   tournage_p1.jpg + _p2.jpg (multi-pages, attendu ndf/TDM)
#   doublon.pdf              (copie identique anthropic_avril.pdf)

# Edge Function déployée : https://eqlofgcravaihvfaysdb.supabase.co/functions/v1/analyze-receipt (v4)
```
