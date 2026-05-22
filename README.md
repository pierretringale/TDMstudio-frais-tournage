# Galactus

> Outil compta interne TDM studio + vu.media. Single-user (Pierre). PWA mobile-first.

Ingère les factures, range les flux financiers en 5 catégories × 3 activités (TDM/VUM/MIX), calcule les remboursements, génère les exports pour Indy.

## Stack

HTML5 + Tailwind CDN + Alpine.js CDN + Supabase (DB + Auth + Storage + 4 Edge Functions Deno) + GitHub Pages.

## État

Sprint 0 terminé (2026-05-22). Sprint 1 (UI shell + nav + auth + PWA) à venir. Voir [PROJET_galactus.md](PROJET_galactus.md) pour l'état détaillé.

## Documentation

- `PROJET_galactus.md` — source de continuité sessions (état + contraintes inviolables)
- `MEMORY.md` — mémoire de session pour reprise CC
- `galactus-decisions.md` — journal des décisions techniques (append-only)
- `galactus-conventions.md` — patterns techniques (audience CC)
- `docs/DESIGN.md` — design system visuel (Sprint 1)
- `docs/CONVENTIONS.md` — conventions métier — nom de fichier, catégories, statuts (Sprint 1)

Brief complet : `~/pierre-brain/tdm-studio/briefs/brief-claude-code-galactus-sprint0-1-2-3-4.md` (vault Pierre).
