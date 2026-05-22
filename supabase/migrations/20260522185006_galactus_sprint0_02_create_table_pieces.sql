CREATE TABLE pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Métadonnées
  date_piece date NOT NULL,
  fournisseur text NOT NULL,
  fournisseur_slug text NOT NULL,
  categorie text NOT NULL CHECK (categorie IN
    ('fournisseur','ndf','materiel','ndf-mois','vente')),
  activite text NOT NULL CHECK (activite IN ('TDM','VUM','MIX')),

  -- Montants
  montant_ht numeric(10,2),
  montant_tva numeric(10,2),
  montant_ttc numeric(10,2) NOT NULL,
  taux_tva numeric(5,2),

  -- Description & fichiers
  description text,
  reference_fournisseur text,
  justificatif_url text NOT NULL,
  nom_fichier_normalise text,
  pages jsonb,

  -- Workflow
  statut text NOT NULL DEFAULT 'a_traiter' CHECK (statut IN
    ('a_traiter','traite','uploade_indy','consolide_dans_ndf_mois','archive')),
  paye_le date,

  -- OCR & doublons
  confiance_ocr numeric(3,2),
  hash_md5 text UNIQUE,
  source text NOT NULL DEFAULT 'manuel' CHECK (source IN
    ('manuel','email','batch_zip')),

  -- Relations
  facture_id uuid REFERENCES factures(id),
  ndf_mois_id uuid REFERENCES pieces(id),

  -- Legacy
  payeur text,
  tournage text,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pieces_date ON pieces(date_piece DESC);
CREATE INDEX idx_pieces_categorie ON pieces(categorie);
CREATE INDEX idx_pieces_activite ON pieces(activite);
CREATE INDEX idx_pieces_statut ON pieces(statut);
CREATE INDEX idx_pieces_fournisseur_slug ON pieces(fournisseur_slug);

COMMENT ON TABLE pieces IS 'Galactus — table centrale des pièces compta (factures, NDF, matériel, ventes). 5 catégories × 3 activités (TDM/VUM/MIX). Schéma figé Sprint 0 du 2026-05-22.';
COMMENT ON COLUMN pieces.payeur IS 'Legacy frais-tournage : indy_cb / indy_virement / pierre_perso. Conservé pour les 14 lignes migrées.';
COMMENT ON COLUMN pieces.tournage IS 'Legacy frais-tournage : T-01 / T-02 / T-03. Conservé pour les 14 lignes migrées.';
