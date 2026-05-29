// === DASHBOARD — Vue #/dashboard (Sprint 3) ===
// Trigger    : x-data="dashboard()" sur <section> dans index.html, instancié à l'affichage de #/dashboard
// Étapes     : load pièces + fournisseurs → calcule KPI/TVA/alertes/graphes → rendu (cards + bannière + SVG)
// Contraintes: 100% Alpine.js + Tailwind, accès Supabase via js/supabase.js uniquement, SVG vanilla (pas de lib)
// Cas limites: aucun ndf-mois en Sprint 3 (déductible = Σ ndf) ; alertes récurrents dormantes (derniere_facture_date NULL)
// Réf : anti-double-comptage NDF documenté dans galactus-decisions.md

import * as sb from './supabase.js';
import { formatMontant, toast } from './utils.js';

const MOIS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// Couleurs activités (alignées badge-act-* dans galactus.css).
const COULEUR_ACT = { TDM: '#1e1d18', VUM: '#ffc857', MIX: '#00d4ff' };
// Périodes (jours) et seuils d'alerte par fréquence.
const PERIODE = { mensuelle: 30, trimestrielle: 90, annuelle: 365 };
const SEUIL = { mensuelle: 35, trimestrielle: 95, annuelle: 380 };
// Ordre fixe des activités pour le camembert.
const ACTIVITES_PIE = ['TDM', 'VUM', 'MIX'];

// === Utilitaires purs (parsing date string-safe, sans piège timezone) ===
function ymd(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return { y, m, d };
}
function joursEntre(aStr, bDate) {
  const p = ymd(aStr);
  if (!p) return null;
  const a = Date.UTC(p.y, p.m - 1, p.d);
  const b = Date.UTC(bDate.getFullYear(), bDate.getMonth() + 1 - 1, bDate.getDate());
  return Math.round((b - a) / 86400000);
}
function arcPath(cx, cy, r, a0, a1) {
  const pt = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x1, y1] = pt(a0);
  const [x2, y2] = pt(a1);
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

// === FONCTION ALPINE COMPOSANT DASHBOARD ===
window.dashboard = function () {
  return {
    loading: true,
    pieces: [],
    fournisseurs: [],
    moisLabel: '',
    // Squelette non-null : Alpine évalue les bindings même sous x-show="false"
    // (pendant le chargement) → éviter tout déréférencement de null.
    data: {
      kpi: {}, tva: {}, alerts: [],
      bars: { svg: '', hasData: false },
      pie: { svg: '', legend: [], total: 0 },
    },

    // ====================================================================
    // === INIT ===========================================================
    // ====================================================================

    async init() {
      console.log('[DASHBOARD] Init composant');
      try {
        const [pieces, fournisseurs] = await Promise.all([
          sb.listPieces({}),
          sb.listFournisseursRecurrents().catch(() => []),
        ]);
        this.pieces = pieces || [];
        this.fournisseurs = fournisseurs || [];
        this.compute();
      } catch (err) {
        console.error('[DASHBOARD] Échec chargement', { message: err.message });
        toast('Erreur de chargement du dashboard', 'error');
      } finally {
        this.loading = false;
      }
    },

    // ====================================================================
    // === PRÉDICATS MÉTIER ===============================================
    // ====================================================================

    // Une pièce est une "dépense" déductible (jamais une vente). Ensemble DISJOINT :
    // on exclut les ndf consolidés (représentés par leur ndf-mois) → aucun double-comptage.
    estDepense(p) {
      if (p.categorie === 'vente') return false;
      if (p.categorie === 'ndf' && p.statut === 'consolide_dans_ndf_mois') return false;
      return true; // fournisseur, materiel, ndf (non consolidé), ndf-mois
    },
    dansMois(p, year, month1) {
      const d = ymd(p.date_piece);
      return d && d.y === year && d.m === month1;
    },
    dansAnnee(p, year) {
      const d = ymd(p.date_piece);
      return d && d.y === year;
    },

    // ====================================================================
    // === CALCUL (un seul passage, résultats figés dans this.data) =======
    // ====================================================================

    compute() {
      const now = new Date();
      const annee = now.getFullYear();
      const mois = now.getMonth() + 1;          // 1-based
      const moisPrec = mois === 1 ? 12 : mois - 1;
      const anneePrec = mois === 1 ? annee - 1 : annee;
      this.moisLabel = `${MOIS_LONG[mois - 1]} ${annee}`;

      const sumTtc = (arr) => arr.reduce((s, p) => s + (Number(p.montant_ttc) || 0), 0);
      const sumTva = (arr) => arr.reduce((s, p) => s + (Number(p.montant_tva) || 0), 0);
      const r2 = (n) => Math.round(n * 100) / 100;

      const ventesAnnee = this.pieces.filter(p => p.categorie === 'vente' && this.dansAnnee(p, annee));
      const ventesMois = ventesAnnee.filter(p => this.dansMois(p, annee, mois));
      const depMois = this.pieces.filter(p => this.estDepense(p) && this.dansMois(p, annee, mois));
      const depParAct = (act, y, m) => this.pieces.filter(p =>
        this.estDepense(p) && p.activite === act && this.dansMois(p, y, m));

      const depTdm = r2(sumTtc(depParAct('TDM', annee, mois)));
      const depTdmPrec = r2(sumTtc(depParAct('TDM', anneePrec, moisPrec)));
      const depVum = r2(sumTtc(depParAct('VUM', annee, mois)));
      const depVumPrec = r2(sumTtc(depParAct('VUM', anneePrec, moisPrec)));

      const delta = (cur, prev) => {
        if (!prev) return cur > 0 ? null : 0;     // null = pas de base de comparaison
        return Math.round((cur - prev) / prev * 100);
      };

      const ndfMois = this.pieces.filter(p => p.categorie === 'ndf' && this.dansMois(p, annee, mois));
      const ndfMoisSynthese = this.pieces.filter(p => p.categorie === 'ndf-mois' && this.dansMois(p, annee, mois));
      const aUploader = this.pieces.filter(p => p.statut === 'a_traiter' || p.statut === 'traite').length;

      // === KPI ===
      const kpi = {
        caYtd: r2(sumTtc(ventesAnnee)),
        caMois: r2(sumTtc(ventesMois)),
        depTdm, depTdmDelta: delta(depTdm, depTdmPrec),
        depVum, depVumDelta: delta(depVum, depVumPrec),
        aUploader,
        ndfTotal: r2(sumTtc(ndfMois)),
        ndfCount: ndfMois.length,
        ndfConsolide: ndfMoisSynthese.length > 0,
      };

      // === Bannière TVA (MIX affiché tel quel, étiqueté "à ventiler" — Indy tranche) ===
      const collectee = r2(sumTva(ventesMois));
      const deductible = r2(sumTva(depMois));
      const tva = {
        collectee,
        deductible,
        deductibleTdm: r2(sumTva(depMois.filter(p => p.activite === 'TDM'))),
        deductibleVum: r2(sumTva(depMois.filter(p => p.activite === 'VUM'))),
        deductibleMix: r2(sumTva(depMois.filter(p => p.activite === 'MIX'))),
        solde: r2(collectee - deductible),
        aucunNdfMois: ndfMoisSynthese.length === 0,   // vrai en Sprint 3
      };

      // === Alertes fournisseurs récurrents ===
      const alerts = this.fournisseurs.map(f => this.evaluerFournisseur(f, now, annee, mois));

      // === Graphe barres : 12 mois glissants, dépenses stacked TDM/VUM/MIX ===
      const bars = this.computeBars(now);

      // === Graphe camembert : répartition dépenses TDM/VUM/MIX année courante ===
      const pie = this.computePie(annee);

      this.data = { kpi, tva, alerts, bars, pie };
    },

    evaluerFournisseur(f, now, annee, mois) {
      const base = { nom: f.nom, frequence: f.frequence, activite: f.activite_defaut };
      if (!f.derniere_facture_date) {
        return { ...base, etat: 'jamais', label: 'jamais ingéré', jours: null };
      }
      const d = ymd(f.derniere_facture_date);
      if (d && d.y === annee && d.m === mois) {
        return { ...base, etat: 'ok', label: 'ingéré ce mois', jours: 0 };
      }
      const jours = joursEntre(f.derniere_facture_date, now);
      const periode = PERIODE[f.frequence] || 30;
      const seuil = SEUIL[f.frequence] || 35;
      const joursAvantEcheance = periode - jours;
      if (jours > seuil) return { ...base, etat: 'retard', label: `dépassement (${jours}j)`, jours };
      if (joursAvantEcheance <= 5) return { ...base, etat: 'attendu', label: `attendu sous ${Math.max(0, joursAvantEcheance)}j`, jours };
      return { ...base, etat: 'ok', label: 'à jour', jours };
    },

    // Renvoie une CHAÎNE SVG (injectée via x-html) : x-for d'Alpine ne crée pas
    // les nœuds dans le namespace SVG → on génère le markup nous-mêmes.
    computeBars(now) {
      const W = 28, barW = 18, H = 130, baseY = 150, width = 12 * W + 6, height = 170;
      const months = [];
      let max = 1, hasData = false;
      for (let k = 11; k >= 0; k--) {
        const dt = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const y = dt.getFullYear(), m = dt.getMonth() + 1;
        const sumActe = (act) => this.pieces
          .filter(p => this.estDepense(p) && p.activite === act && this.dansMois(p, y, m))
          .reduce((s, p) => s + (Number(p.montant_ttc) || 0), 0);
        const tdm = sumActe('TDM'), vum = sumActe('VUM'), mix = sumActe('MIX');
        const total = tdm + vum + mix;
        if (total > 0) hasData = true;
        if (total > max) max = total;
        months.push({ label: MOIS_FR[m - 1], tdm, vum, mix });
      }
      let svg = `<svg viewBox="0 0 ${width} ${height}" class="w-full" style="min-width:336px" xmlns="http://www.w3.org/2000/svg">`;
      svg += `<line x1="0" y1="${baseY}" x2="${width}" y2="${baseY}" stroke="#d9d4be" stroke-width="1"/>`;
      months.forEach((mo, i) => {
        const x = i * W + 6;
        let yCur = baseY;
        [['TDM', mo.tdm], ['VUM', mo.vum], ['MIX', mo.mix]].forEach(([act, val]) => {
          const h = (val / max) * H;
          if (h > 0.5) {
            yCur -= h;
            svg += `<rect x="${x}" y="${yCur.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${COULEUR_ACT[act]}"/>`;
          }
        });
        svg += `<text x="${x + barW / 2}" y="${baseY + 14}" text-anchor="middle" font-size="8" fill="#6f6b58" font-family="monospace">${mo.label}</text>`;
      });
      svg += `</svg>`;
      return { svg, hasData };
    },

    computePie(annee) {
      const sumActe = (act) => this.pieces
        .filter(p => this.estDepense(p) && p.activite === act && this.dansAnnee(p, annee))
        .reduce((s, p) => s + (Number(p.montant_ttc) || 0), 0);
      const vals = ACTIVITES_PIE.map(act => ({ act, value: Math.round(sumActe(act) * 100) / 100 }));
      const total = vals.reduce((s, v) => s + v.value, 0);
      const cx = 60, cy = 60, r = 50;
      let angle = -Math.PI / 2;
      const legend = [];
      let body = '';
      vals.filter(v => v.value > 0).forEach(v => {
        const frac = v.value / total;
        legend.push({ act: v.act, pct: Math.round(frac * 100), color: COULEUR_ACT[v.act] });
        if (frac >= 0.999) {
          body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${COULEUR_ACT[v.act]}"/>`;
        } else {
          const a0 = angle, a1 = angle + frac * 2 * Math.PI;
          angle = a1;
          body += `<path d="${arcPath(cx, cy, r, a0, a1)}" fill="${COULEUR_ACT[v.act]}"/>`;
        }
      });
      if (total === 0) body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f4f0de"/>`;
      const svg = `<svg viewBox="0 0 120 120" class="w-32 h-32 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
      return { svg, legend, total };
    },

    // ====================================================================
    // === NAVIGATION (clic KPI → vue Pièces pré-filtrée) =================
    // ====================================================================

    goPiecesFiltre(prefilter) {
      const store = window.Alpine?.store('app');
      if (store) store.piecesPrefilter = prefilter;
      location.hash = '#/pieces';
    },
    goExports() {
      location.hash = '#/exports';
    },

    // ====================================================================
    // === HELPERS TEMPLATE ===============================================
    // ====================================================================

    fmt(n) { return formatMontant(n); },
    deltaLabel(d) {
      if (d === null || d === undefined) return '—';
      const arrow = d > 0 ? '▲' : (d < 0 ? '▼' : '→');
      return `${arrow} ${d > 0 ? '+' : ''}${d} %`;
    },
    deltaClass(d) {
      if (d === null || d === undefined) return 'text-mid';
      return d > 0 ? 'text-red' : (d < 0 ? 'text-green' : 'text-mid');
    },
    etatIcon(e) {
      return { ok: '✅', attendu: '⏳', retard: '❌', jamais: '—' }[e] || '—';
    },
  };
};
