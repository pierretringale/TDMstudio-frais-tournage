-- Re-pointage des 14 lignes legacy : URL bucket justificatifs-frais → galactus-input
-- Préalable : les 14 fichiers ont été copiés physiquement dans le bucket galactus-input via API HTTP.
-- Le bucket justificatifs-frais reste actif comme backup jusqu'au 2026-08-22 (3 mois).

UPDATE pieces
SET justificatif_url = REPLACE(justificatif_url, '/justificatifs-frais/', '/galactus-input/'),
    updated_at = now()
WHERE justificatif_url LIKE '%/justificatifs-frais/%';
