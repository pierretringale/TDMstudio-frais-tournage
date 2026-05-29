-- Backfill justificatif_path des 14 lignes legacy (déterministe depuis l'URL publique).
UPDATE pieces
SET justificatif_path = 'galactus-input/' || split_part(justificatif_url, '/object/public/galactus-input/', 2)
WHERE justificatif_url LIKE '%/object/public/galactus-input/%'
  AND justificatif_path IS NULL;

-- Seed des 6 fournisseurs récurrents (idempotent via slug UNIQUE).
INSERT INTO fournisseurs_recurrents (nom, slug, frequence, activite_defaut, categorie_defaut, actif) VALUES
('Anthropic','anthropic','mensuelle','MIX','fournisseur',true),
('Render','render','mensuelle','VUM','fournisseur',true),
('Supabase','supabase','mensuelle','MIX','fournisseur',true),
('Cloudflare','cloudflare','mensuelle','MIX','fournisseur',true),
('Orus (RC Pro)','orus','annuelle','TDM','fournisseur',true),
('Indy','indy','mensuelle','MIX','fournisseur',true)
ON CONFLICT (slug) DO NOTHING;
