CREATE TABLE fournisseurs_recurrents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  slug text NOT NULL UNIQUE,
  frequence text NOT NULL CHECK (frequence IN ('mensuelle','trimestrielle','annuelle')),
  activite_defaut text CHECK (activite_defaut IN ('TDM','VUM','MIX')),
  categorie_defaut text CHECK (categorie_defaut IN ('fournisseur','ndf','materiel','vente')),
  jour_estime_facturation smallint,
  derniere_facture_date date,
  derniere_facture_montant numeric(10,2),
  actif boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE fournisseurs_recurrents IS 'Galactus — fournisseurs à attendre périodiquement. Sert à alerter Pierre quand une facture récurrente n''arrive pas (Dashboard Sprint 3).';
