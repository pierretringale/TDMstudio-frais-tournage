-- Policies storage pour galactus-input + galactus-output
-- Calquées sur le pattern legacy 'justificatifs-frais' (anon full access).
-- À durcir au sprint sécu RLS (S23-24) : restreindre à authenticated user Pierre.

CREATE POLICY "galactus_input_read" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'galactus-input');
CREATE POLICY "galactus_input_insert" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'galactus-input');
CREATE POLICY "galactus_input_update" ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'galactus-input') WITH CHECK (bucket_id = 'galactus-input');
CREATE POLICY "galactus_input_delete" ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'galactus-input');

CREATE POLICY "galactus_output_read" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'galactus-output');
CREATE POLICY "galactus_output_insert" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'galactus-output');
CREATE POLICY "galactus_output_update" ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'galactus-output') WITH CHECK (bucket_id = 'galactus-output');
CREATE POLICY "galactus_output_delete" ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'galactus-output');
