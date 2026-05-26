// === APP — Composant Alpine racine + router hash ===
// Trigger    : x-data="app()" sur <body> dans index.html
// Étapes     : init (check session + router) → render conditionnel par currentView
// Contraintes: Alpine unique root, hash routing source de vérité de la vue
// Cas limites: voir docs/CONVENTIONS.md

import * as sb from './supabase.js';
// utils.js importé pour propagation globale via toast event (pas d'import direct ici)

// === FONCTION ALPINE RACINE ===
// Exportée globalement via window.app() pour x-data="app()" dans index.html.
window.app = function () {
  return {
    // === ÉTAT ===
    user: null,
    isAuthed: false,
    currentView: 'ingestion',
    loading: false,

    // Formulaire login
    loginEmail: '',
    loginPassword: '',
    loginError: '',

    // Toasts
    toasts: [],
    nextToastId: 1,

    // === INIT ===
    async init() {
      console.log('[APP] Init Alpine root');

      // Listener événements toast globaux (depuis utils.js toast())
      window.addEventListener('galactus:toast', (e) => {
        this.showToast(e.detail.message, e.detail.type);
      });

      // Listener offline
      window.addEventListener('offline', () => {
        this.showToast('Tu es hors-ligne — fonctionnalités limitées', 'warning');
      });

      // Check session existante
      try {
        const session = await sb.getSession();
        if (session) {
          this.user = session.user;
          this.isAuthed = true;
          console.log('[APP] Session restaurée', { email: this.user.email });
        }
      } catch (err) {
        console.error('[APP] Échec restauration session', { message: err.message });
      }

      // Listener auth change (utile en cas de logout dans un autre tab)
      sb.onAuthChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          this.isAuthed = false;
          this.user = null;
        }
        if (event === 'SIGNED_IN' && session) {
          this.isAuthed = true;
          this.user = session.user;
        }
      });

      // Router init
      this.routeFromHash();
      window.addEventListener('hashchange', () => this.routeFromHash());
    },

    // === ROUTER ===
    routeFromHash() {
      const hash = location.hash.replace('#/', '') || 'ingestion';
      const view = hash.split('/')[0];
      const allowed = ['ingestion', 'dashboard', 'pieces', 'exports', '_demo'];
      if (allowed.includes(view)) {
        this.currentView = view;
      } else {
        this.currentView = 'ingestion';
        location.hash = '#/ingestion';
      }
    },

    navigate(view) {
      location.hash = `#/${view}`;
    },

    // === AUTH ===
    async login() {
      this.loginError = '';
      this.loading = true;
      try {
        const { user } = await sb.signInPierre(this.loginEmail, this.loginPassword);
        this.user = user;
        this.isAuthed = true;
        this.loginEmail = '';
        this.loginPassword = '';
        this.showToast('Connexion réussie', 'success');
      } catch (err) {
        this.loginError = err.message || 'Erreur de connexion';
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await sb.signOut();
        this.isAuthed = false;
        this.user = null;
        this.showToast('Déconnecté', 'info');
      } catch (err) {
        this.showToast('Erreur déconnexion', 'error');
      }
    },

    // === TOASTS ===
    showToast(message, type = 'info') {
      const id = this.nextToastId++;
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, 4000);
    },

    // === HELPERS UI ===
    // Label court vue active pour breadcrumb / titre header
    viewLabel() {
      const map = {
        ingestion: 'INGESTION',
        dashboard: 'DASHBOARD',
        pieces: 'PIÈCES',
        exports: 'EXPORTS',
        _demo: 'DESIGN SYSTEM'
      };
      return map[this.currentView] || '';
    }
  };
};
