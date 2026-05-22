ALTER TABLE frais_tournage RENAME TO _archive_frais_tournage;
COMMENT ON TABLE _archive_frais_tournage IS 'Archive pré-migration galactus 2026-05-22. À drop dans 6 mois si non utilisé.';
