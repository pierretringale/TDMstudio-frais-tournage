-- Sprint 3 : justificatif_path (source de vérité signature à la volée) + solde dette hash + collisions
ALTER TABLE pieces ADD COLUMN justificatif_path text;
COMMENT ON COLUMN pieces.justificatif_path IS 'Chemin storage (bucket/objet) du justificatif. Source de vérité pour signature à la volée. Remplace justificatif_url (déprécié, URL signée 1h périmée).';

-- Solde dette P3 : la colonne contient du SHA-256, le nom legacy est corrigé.
ALTER TABLE pieces RENAME COLUMN hash_md5 TO hash_sha256;

-- Gestion des collisions de hash (réactivation "Créer quand même" = Sprint 3.5).
ALTER TABLE pieces ADD COLUMN hash_collision_n int NOT NULL DEFAULT 0;
ALTER TABLE pieces DROP CONSTRAINT pieces_hash_md5_key;
ALTER TABLE pieces ADD CONSTRAINT pieces_hash_collision_unique UNIQUE (hash_sha256, hash_collision_n);
