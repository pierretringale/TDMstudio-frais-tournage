-- ============================================================================
-- ROLLBACK — Galactus Sprint 3 (migrations Pièces + Dashboard)
-- Généré : 2026-05-29 · Filet de sécurité local (plan Free Supabase = pas de
-- snapshot à la demande). Les migrations Sprint 3 sont NON DESTRUCTIVES (ajout
-- de colonnes, rename, swap de contrainte) — ce fichier permet quand même de
-- revenir intégralement à l'état d'avant si besoin.
--
-- Snapshot data des 14 lignes pieces : rollback-pieces-sprint3-2026-05-29.json
-- (mêmes colonnes que l'état pré-migration : hash_md5, sans justificatif_path).
-- ============================================================================

-- === A) ANNULER LES CHANGEMENTS DE SCHÉMA (ordre inverse de la migration) ===
-- À exécuter dans cet ordre exact.

ALTER TABLE pieces DROP CONSTRAINT IF EXISTS pieces_hash_collision_unique;
ALTER TABLE pieces RENAME COLUMN hash_sha256 TO hash_md5;          -- si le rename a été appliqué
ALTER TABLE pieces ADD CONSTRAINT pieces_hash_md5_key UNIQUE (hash_md5);
ALTER TABLE pieces DROP COLUMN IF EXISTS hash_collision_n;
ALTER TABLE pieces DROP COLUMN IF EXISTS justificatif_path;

-- === B) ANNULER LE SEED fournisseurs_recurrents (6 lignes) ===
DELETE FROM fournisseurs_recurrents
WHERE slug IN ('anthropic','render','supabase','cloudflare','orus','indy');

-- === C) RESTAURER LES 14 LIGNES pieces (UNIQUEMENT si des données ont été perdues) ===
-- ⚠️ Ne lancer que si nécessaire. Exécuter A) d'abord (le schéma doit être revenu
--    à hash_md5 + sans justificatif_path pour matcher le JSON).
-- 1. Copier le contenu de rollback-pieces-sprint3-2026-05-29.json
-- 2. Le coller entre les marqueurs $json$ ... $json$ ci-dessous
-- 3. Décommenter et exécuter :
--
-- TRUNCATE pieces;   -- ⚠️ seulement si la table est corrompue / à réinitialiser
-- INSERT INTO pieces
--   SELECT * FROM json_populate_recordset(null::public.pieces, $json$
--   <COLLER ICI LE TABLEAU JSON DES 14 LIGNES>
--   $json$);
