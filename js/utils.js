// === UTILS — Fonctions pures partagées entre modules ===
// Trigger    : importé par app.js, ingestion.js (Sprint 2), pieces.js (Sprint 3)
// Contraintes: ES2022 module, aucune dépendance externe runtime
// Cas limites: voir docs/CONVENTIONS.md

// === SLUGIFY ===
// Normalise une chaîne en slug kebab-case déterministe.
// "Café & Co" → "cafe-co", "  Hôtel du Nord! " → "hotel-du-nord"
export function slugify(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// === FORMAT DATE ===
// Format ISO → français lisible. format: 'long' | 'short' | 'iso'.
// 'long' = "14 mars 2026", 'short' = "14/03/2026", 'iso' = "2026-03-14"
export function formatDate(iso, format = 'long') {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  if (format === 'iso') return d.toISOString().slice(0, 10);
  const opts = format === 'long'
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Intl.DateTimeFormat('fr-FR', opts).format(d);
}

// === FORMAT MONTANT ===
// Nombre → "12,34 €" (fr-FR currency EUR).
export function formatMontant(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(Number(n));
}

// === HASH FICHIER (SHA-256) ===
// Web Crypto SubtleCrypto n'expose pas MD5 — on utilise SHA-256.
// La colonne DB s'appelle hash_md5 pour des raisons historiques mais contient
// du SHA-256 (voir galactus-decisions.md entrée 4).
// Renvoie une string hex 64 caractères.
export async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// === COMPOSE FILENAME ===
/**
 * Compose le nom de fichier normalisé selon la convention galactus :
 * YYYY-MM-DD_fournisseur-slug_montantTTC_categorie_[TDM|VUM|MIX].pdf
 *
 * Toujours .pdf en sortie. Les pièces multi-pages sont consolidées en PDF unique
 * CÔTÉ CLIENT (pdf-lib, buildPdfFromPages) avant écriture dans galactus-output,
 * donc le nom reste unique par pièce indépendamment du nombre de pages source.
 *
 * Le montant est formaté avec POINT décimal et 2 décimales fixes (CSV-safe pour
 * les exports Indy Sprint 4). Exemple : 1234.5 → "1234.50".
 *
 * @param {Object} piece - { date_piece, fournisseur_slug, montant_ttc, categorie, activite }
 * @returns {string} Le nom de fichier normalisé.
 */
export function composeFilename(piece) {
  const date = formatDate(piece.date_piece, 'iso') || 'sans-date';
  const slug = piece.fournisseur_slug || 'sans-fournisseur';
  const montant = Number(piece.montant_ttc || 0).toFixed(2);
  const cat = piece.categorie || 'sans-cat';
  const act = piece.activite || 'TDM';
  return `${date}_${slug}_${montant}_${cat}_${act}.pdf`;
}

// === TOAST HELPER (global) ===
// Émet un événement custom intercepté par Alpine racine pour afficher un toast.
// Type : 'info' | 'success' | 'error' | 'warning'.
export function toast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('galactus:toast', {
    detail: { message, type }
  }));
}

// === COMPOSE FILENAME SEGMENTS (preview live colorée) ===
/**
 * Décompose le nom de fichier normalisé en segments pour la FilenamePreview live
 * (chaque segment stylé selon qu'il est vide ou rempli). SOURCE UNIQUE partagée
 * par la vue Ingestion (Sprint 2) et la vue Pièces (Sprint 3) — toute évolution
 * de la convention (ex. séparateur décimal point, fix Sprint 2.5) reste cohérente
 * entre les deux previews. Aligné sur composeFilename().
 *
 * @param {Object} fields - { date_piece, fournisseur_slug, fournisseur, montant_ttc, categorie, activite }
 * @returns {Object} segments + marqueurs *Empty pour styles conditionnels.
 */
export function computeFilenameSegments(fields) {
  const f = fields || {};
  const date = f.date_piece ? formatDate(f.date_piece, 'iso') : '';
  const vendor = f.fournisseur_slug || (f.fournisseur ? slugify(f.fournisseur) : '');
  const montant = (f.montant_ttc !== null && f.montant_ttc !== '' && !isNaN(f.montant_ttc))
    ? Number(f.montant_ttc).toFixed(2)
    : '';
  const cat = f.categorie || '';
  const act = f.activite || '';
  return {
    date: date || 'sans-date',
    vendor: vendor || 'sans-fournisseur',
    montant: montant || '0.00',
    cat: cat || 'sans-cat',
    act: act || 'TDM',
    dateEmpty: !date,
    vendorEmpty: !vendor,
    montantEmpty: !montant,
    catEmpty: !cat,
    actEmpty: !act,
  };
}

// === AGRÉGATEUR MONTANTS ===
// Somme HT / TVA / TTC + count sur une liste de pièces (lignes filtrées déjà chargées).
// Utilisé par le footer totaux (Pièces) et les KPI/bannière TVA (Dashboard).
// Les montants NULL comptent comme 0 ; arrondi 2 décimales pour éviter le bruit flottant.
export function sumMontants(pieces) {
  const round2 = (n) => Math.round(n * 100) / 100;
  const list = Array.isArray(pieces) ? pieces : [];
  let sumHt = 0, sumTva = 0, sumTtc = 0;
  for (const p of list) {
    sumHt += Number(p.montant_ht) || 0;
    sumTva += Number(p.montant_tva) || 0;
    sumTtc += Number(p.montant_ttc) || 0;
  }
  return {
    count: list.length,
    sumHt: round2(sumHt),
    sumTva: round2(sumTva),
    sumTtc: round2(sumTtc),
  };
}
