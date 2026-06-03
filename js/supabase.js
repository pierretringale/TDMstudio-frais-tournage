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
// Filtres + tri 100% côté serveur (query Supabase), jamais en JS post-fetch :
// reste juste si une pagination est ajoutée plus tard.
// filters = {
//   recherche, categories[], activites[], statuts[], dateDebut, dateFin,
//   paye ('oui'|'non'|null — ignoré tant que 'fournisseur' n'est pas dans categories),
//   tri:{col,dir}, fournisseur_slug
// }
export async function listPieces(filters = {}) {
  let q = sb.from('pieces').select('*');

  // Multi-valeurs (chips) → .in ; valeur unique (compat) → .eq
  if (Array.isArray(filters.categories) && filters.categories.length) q = q.in('categorie', filters.categories);
  else if (filters.categorie) q = q.eq('categorie', filters.categorie);

  if (Array.isArray(filters.activites) && filters.activites.length) q = q.in('activite', filters.activites);
  else if (filters.activite) q = q.eq('activite', filters.activite);

  if (Array.isArray(filters.statuts) && filters.statuts.length) q = q.in('statut', filters.statuts);
  else if (filters.statut) q = q.eq('statut', filters.statut);

  if (filters.fournisseur_slug) q = q.eq('fournisseur_slug', filters.fournisseur_slug);

  // Plage de dates
  const dateDebut = filters.dateDebut || filters.from;
  const dateFin = filters.dateFin || filters.to;
  if (dateDebut) q = q.gte('date_piece', dateDebut);
  if (dateFin) q = q.lte('date_piece', dateFin);

  // Recherche texte (fournisseur + description + référence). Sanitisation obligatoire :
  // virgule/parenthèses cassent la syntaxe or-filter PostgREST.
  const terme = sanitizeSearchTerm(filters.recherche);
  if (terme) {
    q = q.or(`fournisseur.ilike.%${terme}%,description.ilike.%${terme}%,reference_fournisseur.ilike.%${terme}%`);
  }

  // Filtre payé : pertinent uniquement si la catégorie fournisseur est dans la sélection.
  const fournisseurSelectionne = Array.isArray(filters.categories) && filters.categories.includes('fournisseur');
  if (fournisseurSelectionne && filters.paye === 'oui') q = q.not('paye_le', 'is', null);
  if (fournisseurSelectionne && filters.paye === 'non') q = q.is('paye_le', null);

  // Tri serveur
  const tri = filters.tri || { col: 'date_piece', dir: 'desc' };
  q = q.order(tri.col || 'date_piece', { ascending: (tri.dir || 'desc') === 'asc' });

  const { data, error } = await q;
  if (error) {
    console.error('[SUPABASE-PIECES] Échec listPieces', { message: error.message });
    throw error;
  }
  return data;
}

// Nettoie un terme de recherche des caractères qui cassent un or-filter PostgREST.
function sanitizeSearchTerm(raw) {
  if (!raw) return '';
  return String(raw).replace(/[,()%]/g, ' ').trim();
}

// UPDATE groupé sur une sélection (actions de masse vue Pièces).
// pieceIds = array JS direct dans .in() (JAMAIS JSON.stringify — réservé au JSONB).
// .select() obligatoire : sans lui un UPDATE renvoie "No rows returned" même s'il
// a affecté des lignes (gotcha Supabase) → la vérif serait un faux négatif.
export async function bulkUpdatePieces(pieceIds, patch) {
  const { data, error } = await sb.from('pieces').update(patch).in('id', pieceIds).select();
  if (error) {
    console.error('[SUPABASE-PIECES] Échec bulkUpdatePieces', { n: pieceIds?.length, message: error.message });
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

// Suppression complète d'une pièce : fichiers storage associés PUIS ligne DB.
// Les chemins viennent de justificatif_path (PDF output) + pages[].path_storage_input
// (pages input). On ne touche JAMAIS le bucket legacy justificatifs-frais (backup 3 mois).
// Le nettoyage storage est best-effort (un fichier déjà absent ne bloque pas la suppression DB).
// Confirm UI obligatoire en amont (vue Pièces).
export async function supprimerPieceComplete(piece) {
  // Regroupe les objets à supprimer par bucket (depuis les chemins capturés à l'upload).
  const parBucket = {};
  const ajouter = (path) => {
    if (!path || path === 'pending') return;
    const slash = path.indexOf('/');
    if (slash < 0) return;
    const bucket = path.slice(0, slash);
    if (bucket === 'justificatifs-frais') return; // backup legacy intouchable
    (parBucket[bucket] ||= []).push(path.slice(slash + 1));
  };

  ajouter(piece.justificatif_path);
  if (Array.isArray(piece.pages)) {
    for (const pg of piece.pages) ajouter(pg?.path_storage_input);
  }

  for (const [bucket, objets] of Object.entries(parBucket)) {
    const { error } = await sb.storage.from(bucket).remove(objets);
    if (error) {
      console.warn('[SUPABASE-STORAGE] Échec suppression fichiers (non bloquant)', { bucket, message: error.message });
    }
  }

  await deletePiece(piece.id);
}

// === DB FOURNISSEURS RÉCURRENTS ===
export async function listFournisseursRecurrents() {
  const { data, error } = await sb
    .from('fournisseurs_recurrents')
    .select('*')
    .order('nom');
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

// Signature à la volée d'un justificatif depuis son justificatif_path (Sprint 3, finding B).
// path = "bucket/objet/...eventuels/sous-dossiers" → bucket = 1ᵉʳ segment, objet = reste.
// Aucune URL signée n'est jamais stockée en base : on signe à chaque besoin (toujours frais,
// y compris après > 1h de session). path NULL/'pending' → renvoie null (placeholder côté UI).
export async function signJustificatif(path, opts = {}) {
  if (!path || path === 'pending') return null;
  const slash = path.indexOf('/');
  if (slash < 0) {
    console.warn('[SUPABASE-STORAGE] justificatif_path mal formé (bucket manquant)', { path });
    return null;
  }
  const bucket = path.slice(0, slash);
  const objet = path.slice(slash + 1);
  const expiresIn = opts.expiresIn ?? 3600;
  const transform = opts.transform ? { transform: opts.transform } : undefined;
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(objet, expiresIn, transform);
  if (error) {
    console.error('[SUPABASE-STORAGE] Échec signJustificatif', { bucket, message: error.message });
    return null;
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

// === SPRINT 2 — INGESTION HELPERS ===

// Recherche de la pièce d'origine par hash SHA-256 (dédup avant ingestion).
// Colonne hash_sha256 (renommée au Sprint 3 ; contient un SHA-256 hex 64, voir galactus-decisions.md entrée 4).
// order+limit(1) : sous UNIQUE(hash_sha256, hash_collision_n) un hash peut avoir plusieurs lignes
// (doublons volontaires) — on renvoie l'originale (collision_n le plus bas) sans planter
// (.maybeSingle() seul lèverait une erreur PostgREST dès qu'il existe >1 ligne).
// Renvoie la ligne pieces ou null.
export async function findPieceByHash(hash) {
  const { data, error } = await sb
    .from('pieces')
    .select('id, date_piece, fournisseur, fournisseur_slug, montant_ttc, categorie, activite, statut, reference_fournisseur')
    .eq('hash_sha256', hash)
    .order('hash_collision_n', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[SUPABASE-PIECES] Échec findPieceByHash', { message: error.message });
    throw error;
  }
  return data;
}

// Prochain hash_collision_n libre pour ce hash (0 si aucune pièce, sinon max+1). Sprint 3.5.
// Sert au chemin « Créer quand même » : la nouvelle variante prend max+1.
export async function prochainCollisionN(hash) {
  const { data, error } = await sb
    .from('pieces')
    .select('hash_collision_n')
    .eq('hash_sha256', hash)
    .order('hash_collision_n', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[SUPABASE-PIECES] Échec prochainCollisionN', { message: error.message });
    throw error;
  }
  return (data?.hash_collision_n ?? -1) + 1; // 1ᵉʳ doublon volontaire → 1
}

// Réveille l'alerte d'un fournisseur récurrent : met à jour derniere_facture_date (Sprint 3.5).
// Best-effort STRICT : ne doit JAMAIS faire échouer l'ingestion (la pièce est déjà en base).
// No-op si le slug ne matche aucun fournisseur récurrent. Anti-rewind : ne recule jamais la date.
export async function toucherFournisseurRecurrent(slug, datePiece, montantTtc) {
  if (!slug || !datePiece) return;
  try {
    const { data: fournisseur, error: selErr } = await sb
      .from('fournisseurs_recurrents')
      .select('id, derniere_facture_date')
      .eq('slug', slug)
      .maybeSingle();
    if (selErr) {
      console.error('[SUPABASE-FOURNISSEURS] Échec lecture', { message: selErr.message });
      return;
    }
    if (!fournisseur) return; // fournisseur non récurrent → rien à faire

    // Anti-rewind : YYYY-MM-DD comparable lexicographiquement, ne pas reculer la date.
    if (fournisseur.derniere_facture_date && fournisseur.derniere_facture_date >= datePiece) return;

    const patch = { derniere_facture_date: datePiece };
    if (montantTtc != null && !Number.isNaN(Number(montantTtc))) {
      patch.derniere_facture_montant = Number(montantTtc);
    }
    const { error: updErr } = await sb
      .from('fournisseurs_recurrents')
      .update(patch)
      .eq('id', fournisseur.id);
    if (updErr) console.error('[SUPABASE-FOURNISSEURS] Échec update', { message: updErr.message });
  } catch (erreur) {
    console.error('[SUPABASE-FOURNISSEURS] toucherFournisseurRecurrent', { message: erreur.message });
  }
}

// Invoke l'Edge Function analyze-receipt (Sprint 2).
// pages : [{numero, base64, media_type}]
// hint : {categorie?, activite?} optionnel — override les suggestions OCR
export async function invokeAnalyzeReceipt(pages, hint = null) {
  const { data, error } = await sb.functions.invoke('analyze-receipt', {
    body: { pages, hint },
  });
  if (error) {
    console.error('[SUPABASE-FN] Échec analyze-receipt', { message: error.message });
    throw error;
  }
  if (data?.error === 'quota_exceeded') {
    const e = new Error('quota_exceeded');
    e.code = 'quota_exceeded';
    throw e;
  }
  return data;
}

// Upload + signed URL en une seule opération (Sprint 2 mutualise input/output).
// Renvoie l'URL signée pour preview / référence DB.
export async function uploadAndGetSignedUrl(bucket, file, name, expiresIn = 3600) {
  await uploadFile(bucket, file, name);
  return getSignedUrl(bucket, name, expiresIn);
}
