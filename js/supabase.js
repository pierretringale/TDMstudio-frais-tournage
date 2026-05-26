// === SUPABASE — Client unique + wrappers DB/Auth/Storage ===
// Trigger    : importé par app.js et tous les modules de vue (Sprints 2-4)
// Contraintes: pattern LotR — un seul client global, toutes requêtes passent par ici
// Cas limites: voir docs/CONVENTIONS.md

const SUPABASE_URL = window.GALACTUS_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.GALACTUS_CONFIG?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[SUPABASE] Config manquante — vérifier window.GALACTUS_CONFIG dans index.html');
}
if (!window.supabase) {
  console.error('[SUPABASE] Lib non chargée — vérifier <script src="@supabase/supabase-js"> dans index.html');
}

// === CLIENT UNIQUE ===
// Pattern LotR : un seul createClient pour tout le projet, jamais ailleurs.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage
  }
});

// === AUTH ===
export async function signInPierre(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[SUPABASE-AUTH] Échec connexion', { message: error.message });
    throw new Error('Identifiants invalides');
  }
  return data;
}

export async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) {
    console.error('[SUPABASE-AUTH] Échec déconnexion', { message: error.message });
    throw error;
  }
}

export async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

export function onAuthChange(cb) {
  return sb.auth.onAuthStateChange(cb);
}

// === DB PIECES ===
export async function listPieces(filters = {}) {
  let q = sb.from('pieces').select('*').order('date_piece', { ascending: false });
  if (filters.categorie) q = q.eq('categorie', filters.categorie);
  if (filters.activite) q = q.eq('activite', filters.activite);
  if (filters.statut) q = q.eq('statut', filters.statut);
  if (filters.fournisseur_slug) q = q.eq('fournisseur_slug', filters.fournisseur_slug);
  if (filters.from) q = q.gte('date_piece', filters.from);
  if (filters.to) q = q.lte('date_piece', filters.to);
  const { data, error } = await q;
  if (error) {
    console.error('[SUPABASE-PIECES] Échec listPieces', { message: error.message });
    throw error;
  }
  return data;
}

export async function getPiece(id) {
  const { data, error } = await sb.from('pieces').select('*').eq('id', id).single();
  if (error) {
    console.error('[SUPABASE-PIECES] Échec getPiece', { id, message: error.message });
    throw error;
  }
  return data;
}

export async function insertPiece(piece) {
  const { data, error } = await sb.from('pieces').insert(piece).select().single();
  if (error) {
    console.error('[SUPABASE-PIECES] Échec insertPiece', { message: error.message });
    throw error;
  }
  return data;
}

export async function updatePiece(id, patch) {
  const { data, error } = await sb.from('pieces').update(patch).eq('id', id).select().single();
  if (error) {
    console.error('[SUPABASE-PIECES] Échec updatePiece', { id, message: error.message });
    throw error;
  }
  return data;
}

export async function deletePiece(id) {
  const { error } = await sb.from('pieces').delete().eq('id', id);
  if (error) {
    console.error('[SUPABASE-PIECES] Échec deletePiece', { id, message: error.message });
    throw error;
  }
}

// === DB FOURNISSEURS RÉCURRENTS ===
export async function listFournisseursRecurrents() {
  const { data, error } = await sb
    .from('fournisseurs_recurrents')
    .select('*')
    .order('nom_canonique');
  if (error) {
    console.error('[SUPABASE-FOURNISSEURS] Échec list', { message: error.message });
    throw error;
  }
  return data;
}

// === STORAGE ===
export async function uploadFile(bucket, file, name) {
  const { data, error } = await sb.storage.from(bucket).upload(name, file, { upsert: false });
  if (error) {
    console.error('[SUPABASE-STORAGE] Échec upload', { bucket, name, message: error.message });
    throw error;
  }
  return data;
}

export function getPublicUrl(bucket, name) {
  const { data } = sb.storage.from(bucket).getPublicUrl(name);
  return data.publicUrl;
}

// Signed URL pour buckets privés (cas par défaut galactus).
export async function getSignedUrl(bucket, name, expiresIn = 3600) {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(name, expiresIn);
  if (error) {
    console.error('[SUPABASE-STORAGE] Échec signed URL', { bucket, name, message: error.message });
    throw error;
  }
  return data.signedUrl;
}

export async function deleteFile(bucket, name) {
  const { error } = await sb.storage.from(bucket).remove([name]);
  if (error) {
    console.error('[SUPABASE-STORAGE] Échec delete', { bucket, name, message: error.message });
    throw error;
  }
}
