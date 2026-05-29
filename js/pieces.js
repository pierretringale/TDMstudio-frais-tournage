// === PIÈCES — Vue #/pieces (Sprint 3) ===
// Trigger    : x-data="pieces()" sur <section> dans index.html, instancié à l'affichage de #/pieces
// Étapes     : load DB filtré/trié serveur → tableau desktop / cards mobile → sélection + actions groupées → modal édition
// Contraintes: 100% Alpine.js + Tailwind, accès Supabase via js/supabase.js uniquement (pattern LotR)
// Cas limites: justificatif_path NULL (placeholder), signature à la volée (jamais d'URL morte), filtre payé inactif hors fournisseur
// Réf cas limites: voir PROJET_galactus.md section "Cas limites"

import * as sb from './supabase.js';
import {
  slugify, composeFilename, computeFilenameSegments,
  formatDate, formatMontant, sumMontants, toast,
} from './utils.js';

// === CONSTANTES MÉTIER (enums CHECK — casse stricte) ===
const CATEGORIES = ['fournisseur', 'ndf', 'materiel', 'ndf-mois', 'vente'];
const ACTIVITES = ['TDM', 'VUM', 'MIX'];
const STATUTS = ['a_traiter', 'traite', 'uploade_indy', 'consolide_dans_ndf_mois', 'archive'];
// Catégories assignables à la main dans le modal (ndf-mois = synthèse auto, jamais éditée ici).
const CATEGORIES_EDITABLES = ['fournisseur', 'ndf', 'materiel', 'vente'];
const TAUX_TVA = [20, 10, 5.5, 0];
// Champs qui, modifiés, imposent de recomposer nom_fichier_normalise.
const CHAMPS_CLES = ['date_piece', 'fournisseur_slug', 'montant_ttc', 'categorie', 'activite'];

function todayISO() {
  return formatDate(new Date().toISOString(), 'iso');
}

// Squelette de formulaire d'édition. editModal.data ne doit JAMAIS être null :
// Alpine évalue les x-model même quand le modal est masqué (x-show="false"), et
// x-model ne tolère pas un lvalue null. On part/repart de ce squelette.
function emptyPieceForm() {
  return {
    id: null, date_piece: '', fournisseur: '', fournisseur_slug: '',
    categorie: null, activite: null,
    montant_ht: null, montant_tva: null, montant_ttc: null, taux_tva: null,
    description: '', reference_fournisseur: '', statut: '', paye_le: null,
    justificatif_path: null,
  };
}

// === FONCTION ALPINE COMPOSANT PIÈCES ===
window.pieces = function () {
  return {
    // ====================================================================
    // === ÉTAT ===========================================================
    // ====================================================================

    pieces: [],
    loading: false,
    busy: false,

    // Exposés au template
    CATEGORIES, ACTIVITES, STATUTS, CATEGORIES_EDITABLES, TAUX_TVA,

    filters: {
      recherche: '',
      categories: [],
      activites: [],
      statuts: [],
      dateDebut: '',
      dateFin: '',
      paye: '',                          // '' | 'oui' | 'non'
      tri: { col: 'date_piece', dir: 'desc' },
    },
    searchTimer: null,

    // Sélection multiple
    selection: [],                       // ids
    selectMode: false,                   // mobile : activé au long-press
    longPressTimer: null,

    // Modals
    editModal: { open: false, data: emptyPieceForm(), original: null, previewUrl: '', signing: false },
    deleteModal: { open: false, target: null, bulk: false },
    bulkCatModal: { open: false },

    // ====================================================================
    // === INIT ===========================================================
    // ====================================================================

    async init() {
      console.log('[PIECES] Init composant');
      // Pré-filtre éventuel posé par le Dashboard (clic KPI) — consommé une fois.
      const store = window.Alpine?.store('app');
      if (store?.piecesPrefilter) {
        Object.assign(this.filters, store.piecesPrefilter);
        store.piecesPrefilter = null;
      }
      await this.loadPieces();
    },

    // ====================================================================
    // === CHARGEMENT (filtres + tri 100% serveur) ========================
    // ====================================================================

    async loadPieces() {
      this.loading = true;
      try {
        this.pieces = await sb.listPieces(this.filters);
      } catch (err) {
        console.error('[PIECES] Échec chargement', { message: err.message });
        toast('Erreur de chargement des pièces', 'error');
      } finally {
        this.loading = false;
      }
    },

    // ====================================================================
    // === FILTRES ========================================================
    // ====================================================================

    toggleChip(group, val) {
      const arr = this.filters[group];
      const i = arr.indexOf(val);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(val);
      // Si fournisseur quitte la sélection, le filtre payé n'a plus de sens.
      if (group === 'categories' && !arr.includes('fournisseur')) this.filters.paye = '';
      this.loadPieces();
    },

    chipOn(group, val) {
      return this.filters[group].includes(val);
    },

    get payeDisabled() {
      return !this.filters.categories.includes('fournisseur');
    },

    setPaye(val) {
      if (this.payeDisabled) return;
      this.filters.paye = (this.filters.paye === val) ? '' : val;
      this.loadPieces();
    },

    onSearchInput() {
      // Debounce léger pour éviter une requête par frappe.
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.loadPieces(), 300);
    },

    onDateChange() {
      this.loadPieces();
    },

    get hasActiveFilters() {
      const f = this.filters;
      return !!(f.recherche || f.categories.length || f.activites.length ||
        f.statuts.length || f.dateDebut || f.dateFin || f.paye);
    },

    clearFilters() {
      this.filters.recherche = '';
      this.filters.categories = [];
      this.filters.activites = [];
      this.filters.statuts = [];
      this.filters.dateDebut = '';
      this.filters.dateFin = '';
      this.filters.paye = '';
      this.loadPieces();
    },

    // ====================================================================
    // === TRI ============================================================
    // ====================================================================

    setSort(col) {
      const t = this.filters.tri;
      if (t.col === col) t.dir = (t.dir === 'asc') ? 'desc' : 'asc';
      else { t.col = col; t.dir = 'asc'; }
      this.loadPieces();
    },

    sortArrow(col) {
      if (this.filters.tri.col !== col) return '';
      return this.filters.tri.dir === 'asc' ? ' ▲' : ' ▼';
    },

    // ====================================================================
    // === TOTAUX (footer, lignes filtrées) ===============================
    // ====================================================================

    get totals() {
      return sumMontants(this.pieces);
    },

    // ====================================================================
    // === SÉLECTION MULTIPLE =============================================
    // ====================================================================

    isSelected(id) {
      return this.selection.includes(id);
    },

    toggleSelect(id) {
      const i = this.selection.indexOf(id);
      if (i >= 0) this.selection.splice(i, 1);
      else this.selection.push(id);
      if (this.selection.length === 0) this.selectMode = false;
    },

    get allVisibleSelected() {
      return this.pieces.length > 0 && this.selection.length === this.pieces.length;
    },

    toggleSelectAll() {
      if (this.allVisibleSelected) this.selection = [];
      else this.selection = this.pieces.map(p => p.id);
    },

    clearSelection() {
      this.selection = [];
      this.selectMode = false;
    },

    // Mobile : long-press (450ms) pour entrer en mode sélection.
    startLongPress(id) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = setTimeout(() => {
        this.selectMode = true;
        if (!this.isSelected(id)) this.toggleSelect(id);
      }, 450);
    },

    cancelLongPress() {
      clearTimeout(this.longPressTimer);
    },

    // ====================================================================
    // === ACTIONS GROUPÉES ===============================================
    // ====================================================================

    async marquerUploadeIndy() {
      if (this.busy || this.selection.length === 0) return;
      this.busy = true;
      try {
        await sb.bulkUpdatePieces(this.selection, { statut: 'uploade_indy' });
        toast(`${this.selection.length} pièce(s) marquée(s) uploadée(s) Indy`, 'success');
        this.clearSelection();
        await this.loadPieces();
      } catch (err) {
        console.error('[PIECES] Échec marquer uploadé', { message: err.message });
        toast('Erreur action groupée', 'error');
      } finally {
        this.busy = false;
      }
    },

    openBulkCat() {
      if (this.selection.length === 0) return;
      this.bulkCatModal.open = true;
    },

    // Éditer la catégorie en masse : catégorie = champ clé → recompose nom_fichier_normalise
    // par pièce (DB-only ; le fichier physique n'est pas déplacé, cf. §4.3 / Sprint 4).
    async applyBulkCat(cat) {
      if (this.busy) return;
      this.busy = true;
      try {
        const selected = this.pieces.filter(p => this.selection.includes(p.id));
        for (const p of selected) {
          const nom = composeFilename({ ...p, categorie: cat });
          await sb.updatePiece(p.id, { categorie: cat, nom_fichier_normalise: nom });
        }
        toast(`Catégorie « ${cat} » appliquée à ${selected.length} pièce(s)`, 'success');
        this.bulkCatModal.open = false;
        this.clearSelection();
        await this.loadPieces();
      } catch (err) {
        console.error('[PIECES] Échec édition catégorie masse', { message: err.message });
        toast('Erreur édition catégorie', 'error');
      } finally {
        this.busy = false;
      }
    },

    // ====================================================================
    // === SUPPRESSION (confirm obligatoire) ==============================
    // ====================================================================

    confirmDelete(piece) {
      this.deleteModal = { open: true, target: piece, bulk: false };
    },

    confirmDeleteSelection() {
      if (this.selection.length === 0) return;
      this.deleteModal = { open: true, target: null, bulk: true };
    },

    closeDelete() {
      this.deleteModal = { open: false, target: null, bulk: false };
    },

    async doDelete() {
      if (this.busy) return;
      this.busy = true;
      try {
        if (this.deleteModal.bulk) {
          const selected = this.pieces.filter(p => this.selection.includes(p.id));
          for (const p of selected) await sb.supprimerPieceComplete(p);
          toast(`${selected.length} pièce(s) supprimée(s)`, 'success');
          this.clearSelection();
        } else {
          await sb.supprimerPieceComplete(this.deleteModal.target);
          toast('Pièce supprimée', 'success');
        }
        this.closeDelete();
        await this.loadPieces();
      } catch (err) {
        console.error('[PIECES] Échec suppression', { message: err.message });
        toast('Erreur suppression', 'error');
      } finally {
        this.busy = false;
      }
    },

    // ====================================================================
    // === JUSTIFICATIF (signature à la demande) ==========================
    // ====================================================================

    async voirJustificatif(piece) {
      const url = await sb.signJustificatif(piece.justificatif_path);
      if (!url) {
        toast('Justificatif indisponible', 'warning');
        return;
      }
      window.open(url, '_blank', 'noopener');
    },

    // ====================================================================
    // === MODAL ÉDITION ==================================================
    // ====================================================================

    async openEdit(piece) {
      this.editModal = {
        open: true,
        data: { ...piece },
        original: { ...piece },
        previewUrl: '',
        signing: true,
      };
      // Preview full-res signée à l'ouverture (toujours fraîche).
      this.editModal.previewUrl = await sb.signJustificatif(piece.justificatif_path) || '';
      this.editModal.signing = false;
    },

    closeEdit() {
      this.editModal = { open: false, data: emptyPieceForm(), original: null, previewUrl: '', signing: false };
    },

    onEditFournisseurInput() {
      this.editModal.data.fournisseur_slug = slugify(this.editModal.data.fournisseur);
    },

    selectEditCategorie(c) {
      this.editModal.data.categorie = c;
    },

    selectEditActivite(a) {
      this.editModal.data.activite = a;
    },

    editFilenameSegments() {
      return computeFilenameSegments(this.editModal.data || {});
    },

    get editPayeChecked() {
      return !!this.editModal.data?.paye_le;
    },

    toggleEditPaye(checked) {
      // Coché → date du jour (conserve une date existante) ; décoché → null.
      if (checked) this.editModal.data.paye_le = this.editModal.data.paye_le || todayISO();
      else this.editModal.data.paye_le = null;
    },

    // Une donnée clé (impactant le nom de fichier) a-t-elle changé ?
    keyFieldChanged() {
      const d = this.editModal.data, o = this.editModal.original;
      if (!d || !o) return false;
      return CHAMPS_CLES.some(k => String(d[k] ?? '') !== String(o[k] ?? ''));
    },

    get showIndyWarning() {
      return this.editModal.original?.statut === 'uploade_indy' && this.keyFieldChanged();
    },

    canSaveEdit() {
      const d = this.editModal.data;
      if (!d) return false;
      return !!(
        d.fournisseur && d.date_piece && d.categorie && d.activite &&
        d.montant_ttc !== null && d.montant_ttc !== '' && !isNaN(d.montant_ttc) && Number(d.montant_ttc) > 0
      );
    },

    async saveEdit() {
      if (this.busy) return;
      if (!this.canSaveEdit()) {
        toast('Champs obligatoires : fournisseur, date, catégorie, activité, montant TTC > 0', 'warning');
        return;
      }
      this.busy = true;
      try {
        const d = this.editModal.data;
        const patch = {
          date_piece: d.date_piece,
          fournisseur: d.fournisseur,
          fournisseur_slug: d.fournisseur_slug || slugify(d.fournisseur),
          categorie: d.categorie,
          activite: d.activite,
          montant_ht: (d.montant_ht !== null && d.montant_ht !== '') ? Number(d.montant_ht) : null,
          montant_tva: (d.montant_tva !== null && d.montant_tva !== '') ? Number(d.montant_tva) : null,
          montant_ttc: Number(d.montant_ttc),
          taux_tva: (d.taux_tva !== null && d.taux_tva !== '') ? Number(d.taux_tva) : null,
          description: d.description || null,
          reference_fournisseur: d.reference_fournisseur || null,
          statut: d.statut,
          paye_le: d.paye_le || null,
        };
        // Recompose le nom d'affichage/export si une donnée clé a bougé.
        // IMPORTANT : justificatif_path N'EST PAS touché (rename physique différé Sprint 4).
        if (this.keyFieldChanged()) {
          patch.nom_fichier_normalise = composeFilename({
            date_piece: patch.date_piece,
            fournisseur_slug: patch.fournisseur_slug,
            montant_ttc: patch.montant_ttc,
            categorie: patch.categorie,
            activite: patch.activite,
          });
        }
        await sb.updatePiece(d.id, patch);   // updatePiece fait .select().single() → vérif réelle
        toast('Pièce mise à jour', 'success');
        this.closeEdit();
        await this.loadPieces();
      } catch (err) {
        console.error('[PIECES] Échec sauvegarde', { message: err.message });
        toast('Erreur de sauvegarde', 'error');
      } finally {
        this.busy = false;
      }
    },

    // ====================================================================
    // === HELPERS TEMPLATE ===============================================
    // ====================================================================

    fmtDate(iso) { return formatDate(iso, 'short'); },
    fmtMontant(n) { return formatMontant(n); },

    catBadge(c) { return `badge badge-cat-${c}`; },
    actBadge(a) { return `badge badge-act-${(a || '').toLowerCase()}`; },
    statutBadge(s) { return `badge badge-status-${s}`; },
    statutLabel(s) { return (s || '').replace(/_/g, ' '); },
  };
};
