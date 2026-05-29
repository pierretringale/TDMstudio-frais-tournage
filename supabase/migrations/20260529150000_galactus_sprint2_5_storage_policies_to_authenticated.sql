-- Galactus Sprint 2.5 — fix RLS Storage (2026-05-29)
-- Les 8 policies galactus_* sur storage.objects créées au Sprint 0 (migration n°05)
-- étaient scopées rôle `anon` (héritage frais-tournage qui tapait Storage sans login).
-- Le Sprint 1 a introduit l'auth Supabase → uploads en rôle `authenticated` →
-- aucune policy ne matchait → 400 "new row violates row-level security policy".
-- Fix : repointer les 8 policies vers `authenticated`.
-- Appliqué en prod via MCP apply_migration le 2026-05-29 (ce fichier = versionnement).

ALTER POLICY galactus_input_insert  ON storage.objects TO authenticated;
ALTER POLICY galactus_input_read    ON storage.objects TO authenticated;
ALTER POLICY galactus_input_update  ON storage.objects TO authenticated;
ALTER POLICY galactus_input_delete  ON storage.objects TO authenticated;
ALTER POLICY galactus_output_insert ON storage.objects TO authenticated;
ALTER POLICY galactus_output_read   ON storage.objects TO authenticated;
ALTER POLICY galactus_output_update ON storage.objects TO authenticated;
ALTER POLICY galactus_output_delete ON storage.objects TO authenticated;
