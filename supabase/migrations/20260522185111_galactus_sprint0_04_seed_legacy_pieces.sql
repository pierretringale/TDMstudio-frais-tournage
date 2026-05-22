INSERT INTO pieces (
  id, date_piece, fournisseur, fournisseur_slug, categorie, activite,
  montant_ttc, taux_tva, description, justificatif_url, statut,
  payeur, tournage, created_at, updated_at
)
SELECT
  id,
  date_depense,
  'Legacy tournage ' || tournage,
  'legacy-tournage-' || LOWER(REGEXP_REPLACE(tournage, '[^a-zA-Z0-9]', '-', 'g')),
  'ndf',
  'TDM',
  montant,
  taux_tva,
  description,
  COALESCE(justificatif_url, 'legacy-no-url'),
  'archive',
  payeur,
  tournage,
  COALESCE(created_at, now()),
  COALESCE(created_at, now())
FROM _archive_frais_tournage;
