// === INGESTION — Vue #/ingestion (Sprint 2) ===
// Trigger    : x-data="ingestion()" sur <section> dans index.html, instancié à l'affichage de #/ingestion
// Étapes     : capture/drop → OCR Edge Function → validation post-OCR → INSERT pieces → upload buckets → UPDATE
// Contraintes: 100% Alpine.js + Tailwind, accès Supabase via js/supabase.js uniquement (pattern LotR)
// Cas limites: PDF chiffré (toast clair), HEIC iOS (refus), CDN pdf-lib down (toast), 429 quota (toast)

import * as sb from './supabase.js';
import { slugify, hashFile, composeFilename, computeFilenameSegments, formatDate, formatMontant, toast } from './utils.js';

// === FONCTION ALPINE COMPOSANT INGESTION ===
window.ingestion = function () {
  return {
    // ====================================================================
    // === ÉTAT ===========================================================
    // ====================================================================

    subview: 'home',                       // 'home' | 'ocr' | 'validation'

    // Pages en cours d'ingestion : [{numero, file, base64, mediaType, previewUrl}]
    pages: [],
    currentPreviewPage: 0,                 // index page affichée dans la preview validation

    // Hint utilisateur (optionnel, override les suggestions OCR)
    hint: { categorie: null, activite: null },

    // État OCR
    isOCR: false,
    ocrStartTs: 0,
    ocrElapsed: 0,                         // ms
    ocrTimerId: null,

    // Données du formulaire (extraites OCR puis éditables Pierre)
    formData: {
      date_piece: '',
      fournisseur: '',
      fournisseur_slug: '',
      reference_fournisseur: '',
      montant_ht: null,
      montant_tva: null,
      montant_ttc: null,
      taux_tva: 20,                        // default 20% (cas le plus fréquent FR)
      taux_tva_choice: '20',               // select : '20' | '10' | '5.5' | '0' | 'autre'
      categorie: null,
      activite: null,
      description: '',
      confiance_ocr: 0,                    // 0-1
    },

    // Confiance par champ (volatile UI, pas persisté DB Sprint 2)
    confidencePerField: {
      fournisseur: 0,
      date: 0,
      montant: 0,
      categorie: 0,
      activite: 0,
    },

    ocrTextBrut: '',                       // archive debug

    // Hash SHA-256 1ʳᵉ page (calculé une seule fois après OCR)
    fileHash: null,

    // Mode rafale (miroir de $store.app.rafaleMode)
    isRafale: false,
    rafaleCount: 0,

    // Modal doublon
    doublon: {
      open: false,
      existing: null,                      // {id, date_piece, fournisseur, montant_ttc, categorie, activite, ...}
    },

    // Modal multi-pièces (drop multiple desktop)
    multiDrop: {
      open: false,
      files: [],                           // FileList capturée
    },

    busy: false,                           // upload/insert en cours

    // ====================================================================
    // === INIT ==========================================================
    // ====================================================================

    init() {
      console.log('[INGESTION] Init composant');

      // Warning fermeture page si pages en cours
      window.addEventListener('beforeunload', (e) => {
        if (this.pages.length > 0 && this.subview !== 'home') {
          e.preventDefault();
          e.returnValue = '';
        }
      });
    },

    // ====================================================================
    // === CAPTURE & DROP =================================================
    // ====================================================================

    capturePhoto() {
      this.$refs.cameraInput?.click();
    },

    pickFile() {
      this.$refs.fileInput?.click();
    },

    async onFilesSelected(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      await this.handleFiles(files);
      event.target.value = '';             // reset input pour permettre re-sélection même fichier
    },

    async onDrop(event) {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      await this.handleFiles(files);
    },

    async handleFiles(fileList) {
      const files = Array.from(fileList);

      // Validation format (refus HEIC, autres formats non supportés)
      for (const f of files) {
        if (!this.isFormatAllowed(f)) {
          toast(`Format non supporté : ${f.name}. Active JPG dans Réglages iPhone > Appareil photo > Formats.`, 'error');
          return;
        }
      }

      // Single file → push direct
      if (files.length === 1) {
        await this.pushPage(files[0]);
        return;
      }

      // Multi-files desktop → modal de choix
      this.multiDrop.files = files;
      this.multiDrop.open = true;
    },

    isFormatAllowed(file) {
      const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
      // Certains navigateurs envoient type vide pour les fichiers connus → fallback extension
      if (file.type && allowed.includes(file.type)) return true;
      const ext = file.name.toLowerCase().split('.').pop();
      return ['jpg', 'jpeg', 'png', 'pdf'].includes(ext);
    },

    async chooseMultiDropMode(mode) {
      // mode = 'same' (toutes les pages d'une même pièce) ou 'separate' (Sprint 2 = 1ʳᵉ + toast)
      const files = this.multiDrop.files;
      this.multiDrop.open = false;

      if (mode === 'same') {
        for (const f of files) {
          await this.pushPage(f);
        }
      } else {
        await this.pushPage(files[0]);
        toast(`Sprint 2 : pièces séparées indisponibles — valide cette pièce puis recommence pour les ${files.length - 1} autres`, 'warning');
      }

      this.multiDrop.files = [];
    },

    async pushPage(file) {
      const base64 = await this.fileToBase64(file);
      const previewUrl = URL.createObjectURL(file);
      this.pages.push({
        numero: this.pages.length + 1,
        file,
        base64,
        mediaType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        previewUrl,
      });
    },

    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;                          // "data:image/jpeg;base64,XXX"
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.substring(idx + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    addPage() {
      // Bouton "+ page" sur la home → re-ouvre file picker
      this.pickFile();
    },

    removePage(idx) {
      const page = this.pages[idx];
      if (page?.previewUrl) URL.revokeObjectURL(page.previewUrl);
      this.pages.splice(idx, 1);
      // Renumérote
      this.pages.forEach((p, i) => p.numero = i + 1);
      if (this.currentPreviewPage >= this.pages.length) {
        this.currentPreviewPage = Math.max(0, this.pages.length - 1);
      }
    },

    // ====================================================================
    // === OCR PIPELINE ===================================================
    // ====================================================================

    async startOCR() {
      if (this.pages.length === 0) {
        toast('Ajoute au moins une page', 'warning');
        return;
      }

      // === GARDE SECURE CONTEXT (crypto.subtle requiert HTTPS ou localhost) ===
      if (!window.isSecureContext || !window.crypto?.subtle) {
        toast('Galactus nécessite HTTPS (ou localhost). Sur iPhone en test local, passe par un tunnel HTTPS.', 'error');
        return;
      }

      this.subview = 'ocr';
      this.isOCR = true;
      this.ocrStartTs = Date.now();
      this.ocrElapsed = 0;
      this.ocrTimerId = setInterval(() => {
        this.ocrElapsed = Date.now() - this.ocrStartTs;
      }, 100);

      try {
        // 1. Hash 1ʳᵉ page (identifiant de la pièce)
        this.fileHash = await hashFile(this.pages[0].file);

        // 2. Appel Edge Function avec toutes les pages
        const ocrInput = this.pages.map(p => ({
          numero: p.numero,
          base64: p.base64,
          media_type: p.mediaType,
        }));
        const hint = (this.hint.categorie || this.hint.activite) ? this.hint : null;
        const ocrResult = await sb.invokeAnalyzeReceipt(ocrInput, hint);

        // 3. Peuple formData (assigne champ par champ pour préserver Alpine reactivity)
        this.applyOcrResult(ocrResult);

        // 4. Check doublon (en parallèle avec rendering, non-bloquant)
        try {
          const existing = await sb.findPieceByHash(this.fileHash);
          if (existing) {
            this.doublon.existing = existing;
            this.doublon.open = true;
          }
        } catch (err) {
          console.warn('[INGESTION] Échec check doublon', { message: err.message });
        }

        // 5. Bascule sur validation
        this.subview = 'validation';
      } catch (err) {
        this.subview = 'home';
        if (err.code === 'quota_exceeded') {
          toast('Quota OCR dépassé temporairement, réessaie dans quelques minutes', 'error');
        } else {
          toast(`Échec OCR : ${err.message}`, 'error');
        }
        console.error('[INGESTION] Échec OCR pipeline', { message: err.message });
      } finally {
        this.isOCR = false;
        if (this.ocrTimerId) {
          clearInterval(this.ocrTimerId);
          this.ocrTimerId = null;
        }
      }
    },

    applyOcrResult(r) {
      // Assigne champ par champ (préserve Proxy Alpine)
      this.formData.date_piece = r?.date_piece || '';
      this.formData.fournisseur = r?.fournisseur || '';
      this.formData.fournisseur_slug = r?.fournisseur_slug || (r?.fournisseur ? slugify(r.fournisseur) : '');
      this.formData.reference_fournisseur = r?.reference_fournisseur || '';
      this.formData.montant_ht = (r?.montant_ht !== null && r?.montant_ht !== undefined) ? Number(r.montant_ht) : null;
      this.formData.montant_tva = (r?.montant_tva !== null && r?.montant_tva !== undefined) ? Number(r.montant_tva) : null;
      this.formData.montant_ttc = (r?.montant_ttc !== null && r?.montant_ttc !== undefined) ? Number(r.montant_ttc) : null;
      const taux = (r?.taux_tva !== null && r?.taux_tva !== undefined) ? Number(r.taux_tva) : 20;
      this.formData.taux_tva = taux;
      this.formData.taux_tva_choice = this.tauxToChoice(taux);
      this.formData.categorie = (r?.categorie_suggeree && r.categorie_suggeree !== 'ndf-mois') ? r.categorie_suggeree : null;
      this.formData.activite = r?.activite_suggeree || null;
      this.formData.description = r?.description || '';
      this.formData.confiance_ocr = (r?.confiance_ocr !== null && r?.confiance_ocr !== undefined) ? Number(r.confiance_ocr) : 0;

      // Confidence per field
      const cpf = r?.confidence_per_field || {};
      this.confidencePerField.fournisseur = Number(cpf.fournisseur || 0);
      this.confidencePerField.date = Number(cpf.date || 0);
      this.confidencePerField.montant = Number(cpf.montant || 0);
      this.confidencePerField.categorie = Number(cpf.categorie || 0);
      this.confidencePerField.activite = Number(cpf.activite || 0);

      this.ocrTextBrut = r?.ocr_text_brut || '';
    },

    tauxToChoice(taux) {
      const canon = [20, 10, 5.5, 0];
      return canon.includes(Number(taux)) ? String(taux) : 'autre';
    },

    ocrTimeLabel() {
      return `${(this.ocrElapsed / 1000).toFixed(1)}s`;
    },

    // ====================================================================
    // === MODE RAFALE ====================================================
    // ====================================================================

    enterRafale() {
      this.isRafale = true;
      this.rafaleCount = 0;
      if (window.Alpine?.store) window.Alpine.store('app').rafaleMode = true;
      toast('Mode rafale activé — édition disponible Sprint 3 via vue Pièces', 'info');
    },

    exitRafale() {
      this.isRafale = false;
      this.rafaleCount = 0;
      if (window.Alpine?.store) window.Alpine.store('app').rafaleMode = false;
    },

    // ====================================================================
    // === PAGINATION PREVIEW =============================================
    // ====================================================================

    prevPreviewPage() {
      if (this.currentPreviewPage > 0) this.currentPreviewPage--;
    },

    nextPreviewPage() {
      if (this.currentPreviewPage < this.pages.length - 1) this.currentPreviewPage++;
    },

    // ====================================================================
    // === FORMULAIRE - INTERACTIONS ======================================
    // ====================================================================

    onFournisseurInput() {
      this.formData.fournisseur_slug = slugify(this.formData.fournisseur);
    },

    onTauxTvaChoice(val) {
      this.formData.taux_tva_choice = val;
      if (val !== 'autre') {
        this.formData.taux_tva = parseFloat(val);
        this.recalcMontants('taux');
      }
    },

    onTauxTvaAutreInput(val) {
      const n = parseFloat(val);
      if (!isNaN(n)) {
        this.formData.taux_tva = n;
        this.recalcMontants('taux');
      }
    },

    selectCategorie(cat) {
      this.formData.categorie = (this.formData.categorie === cat) ? null : cat;
    },

    selectActivite(act) {
      this.formData.activite = (this.formData.activite === act) ? null : act;
    },

    recalcMontants(triggeredBy) {
      // Auto-calcul HT/TVA/TTC : si 2/3 montants présents, déduit le 3ᵉ
      const fd = this.formData;
      const ht = fd.montant_ht;
      const tva = fd.montant_tva;
      const ttc = fd.montant_ttc;
      const taux = fd.taux_tva;

      const hasHt = ht !== null && ht !== '' && !isNaN(ht);
      const hasTva = tva !== null && tva !== '' && !isNaN(tva);
      const hasTtc = ttc !== null && ttc !== '' && !isNaN(ttc);
      const hasTaux = taux !== null && taux !== '' && !isNaN(taux);

      const round2 = (n) => Math.round(n * 100) / 100;

      // Cas 1 : HT + taux → calcule TVA et TTC
      if (hasHt && hasTaux && (!hasTva || triggeredBy === 'ht' || triggeredBy === 'taux')) {
        const tvaCalc = round2(Number(ht) * Number(taux) / 100);
        fd.montant_tva = tvaCalc;
        fd.montant_ttc = round2(Number(ht) + tvaCalc);
        return;
      }

      // Cas 2 : TTC + taux → calcule HT et TVA
      if (hasTtc && hasTaux && (!hasHt || triggeredBy === 'ttc' || triggeredBy === 'taux')) {
        const htCalc = round2(Number(ttc) / (1 + Number(taux) / 100));
        fd.montant_ht = htCalc;
        fd.montant_tva = round2(Number(ttc) - htCalc);
        return;
      }

      // Cas 3 : HT + TVA → TTC
      if (hasHt && hasTva && !hasTtc) {
        fd.montant_ttc = round2(Number(ht) + Number(tva));
        return;
      }

      // Cas 4 : HT + TTC → TVA (et déduit taux si possible)
      if (hasHt && hasTtc && !hasTva) {
        fd.montant_tva = round2(Number(ttc) - Number(ht));
        if (Number(ht) > 0) {
          fd.taux_tva = round2(fd.montant_tva / Number(ht) * 100);
          fd.taux_tva_choice = this.tauxToChoice(fd.taux_tva);
        }
        return;
      }
    },

    // ====================================================================
    // === FILENAME PREVIEW ===============================================
    // ====================================================================

    filenameSegments() {
      // Source unique partagée avec la vue Pièces (utils.computeFilenameSegments).
      return computeFilenameSegments(this.formData);
    },

    confidenceClass(field) {
      const c = this.confidencePerField[field] || 0;
      if (c >= 0.8) return 'field-conf-high';
      if (c >= 0.5) return 'field-conf-mid';
      return 'field-conf-low';
    },

    confidencePct(field) {
      const c = this.confidencePerField[field] || 0;
      return Math.round(c * 100);
    },

    globalConfidencePct() {
      return Math.round((this.formData.confiance_ocr || 0) * 100);
    },

    // ====================================================================
    // === MODAL DOUBLON ==================================================
    // ====================================================================

    closeDoublon() {
      this.doublon.open = false;
      this.doublon.existing = null;
    },

    formatExistingInfo() {
      const e = this.doublon.existing;
      if (!e) return '';
      return `${formatDate(e.date_piece, 'long')} · ${formatMontant(e.montant_ttc)} TTC`;
    },

    // ====================================================================
    // === BUILD PDF (côté client via pdf-lib UMD) ========================
    // ====================================================================

    async buildPdfFromPages() {
      if (!window.PDFLib) {
        throw new Error('pdf-lib non chargé (CDN unpkg indisponible ?)');
      }
      const { PDFDocument } = window.PDFLib;
      const doc = await PDFDocument.create();

      for (const page of this.pages) {
        const bytes = await page.file.arrayBuffer();

        if (page.mediaType === 'application/pdf') {
          // PDF source → copy pages (peut planter si chiffré)
          try {
            const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
            const copied = await doc.copyPages(src, src.getPageIndices());
            copied.forEach(p => doc.addPage(p));
          } catch (err) {
            console.error('[INGESTION] PDF chiffré ou corrompu', { name: page.file.name, message: err.message });
            throw new Error('PDF_ENCRYPTED');
          }
        } else {
          // Image → embed + page A4 portrait centrée
          const img = page.mediaType === 'image/png'
            ? await doc.embedPng(bytes)
            : await doc.embedJpg(bytes);
          // A4 portrait : 595 x 842 pts
          const pw = 595, ph = 842;
          const scale = Math.min(pw / img.width, ph / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const newPage = doc.addPage([pw, ph]);
          newPage.drawImage(img, {
            x: (pw - w) / 2,
            y: (ph - h) / 2,
            width: w,
            height: h,
          });
        }
      }

      const pdfBytes = await doc.save();
      return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    // ====================================================================
    // === VALIDATION & SAVE ==============================================
    // ====================================================================

    canValidate() {
      const fd = this.formData;
      return !!(
        fd.fournisseur &&
        fd.date_piece &&
        fd.categorie &&
        fd.activite &&
        fd.montant_ttc !== null && fd.montant_ttc !== '' && !isNaN(fd.montant_ttc) && Number(fd.montant_ttc) > 0
      );
    },

    async validateAndSave({ continueRafale }) {
      if (this.busy) return;

      // Validation client
      if (!this.canValidate()) {
        toast('Champs obligatoires : fournisseur, date, catégorie, activité, montant TTC > 0', 'warning');
        return;
      }

      this.busy = true;

      try {
        const fd = this.formData;
        const outputFilename = composeFilename({
          date_piece: fd.date_piece,
          fournisseur_slug: fd.fournisseur_slug || slugify(fd.fournisseur),
          montant_ttc: fd.montant_ttc,
          categorie: fd.categorie,
          activite: fd.activite,
        });

        // 1. Build PDF mémoire (peut planter sur PDF chiffré)
        let pdfBlob;
        try {
          pdfBlob = await this.buildPdfFromPages();
        } catch (err) {
          if (err.message === 'PDF_ENCRYPTED') {
            toast('PDF protégé non supporté — déprotège via Aperçu macOS (Fichier > Exporter > sans mot de passe) puis re-upload', 'error');
          } else {
            toast(`Échec construction PDF : ${err.message}`, 'error');
          }
          this.busy = false;
          return;
        }

        // === Clés storage capturées UNE fois (principe d'or) ===
        // La clé écrite en base est EXACTEMENT celle passée à upload() — jamais reconstruite.
        const ext = (m) => (m === 'application/pdf' ? 'pdf' : (m === 'image/png' ? 'png' : 'jpg'));
        const outputKey = outputFilename;                                              // objet dans galactus-output
        const inputKeys = this.pages.map((p, i) => `${this.fileHash}-p${i + 1}.${ext(p.mediaType)}`); // objets galactus-input

        // 2. INSERT pieces. justificatif_path = source de vérité (signature à la volée).
        // justificatif_url reste 'pending' (colonne dépréciée, plus jamais d'URL signée stockée).
        const insertPayload = {
          date_piece: fd.date_piece,
          fournisseur: fd.fournisseur,
          fournisseur_slug: fd.fournisseur_slug || slugify(fd.fournisseur),
          categorie: fd.categorie,
          activite: fd.activite,
          montant_ht: (fd.montant_ht !== null && fd.montant_ht !== '') ? Number(fd.montant_ht) : null,
          montant_tva: (fd.montant_tva !== null && fd.montant_tva !== '') ? Number(fd.montant_tva) : null,
          montant_ttc: Number(fd.montant_ttc),
          taux_tva: (fd.taux_tva !== null && fd.taux_tva !== '') ? Number(fd.taux_tva) : null,
          description: fd.description || null,
          reference_fournisseur: fd.reference_fournisseur || null,
          justificatif_url: 'pending',
          justificatif_path: `galactus-output/${outputKey}`,
          nom_fichier_normalise: outputFilename,
          statut: 'traite',
          confiance_ocr: Number(fd.confiance_ocr || 0),
          hash_sha256: this.fileHash,
        };

        let inserted;
        try {
          inserted = await sb.insertPiece(insertPayload);
        } catch (err) {
          // UNIQUE collision sur hash_md5 → doublon strict
          if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
            toast('Doublon strict refusé : cette pièce existe déjà en DB', 'error');
          } else {
            toast(`Échec enregistrement : ${err.message}`, 'error');
          }
          console.error('[INGESTION] Échec INSERT', { message: err.message });
          this.busy = false;
          return;
        }

        // 3. Uploads parallèles : pages originales (input) + PDF concaténé (output).
        // Plus de signature ici — on signe à la volée au moment de la preview (vue Pièces).
        const inputUploads = this.pages.map((p, i) =>
          sb.uploadFile('galactus-input', p.file, inputKeys[i])
        );
        const outputUpload = sb.uploadFile('galactus-output', pdfBlob, outputKey);

        try {
          await Promise.all([Promise.all(inputUploads), outputUpload]);
        } catch (err) {
          toast(`Échec upload buckets : ${err.message}`, 'error');
          console.error('[INGESTION] Échec upload', { message: err.message });
          // Pièce en DB mais fichier(s) manquant(s) — la preview dégradera en placeholder.
          this.busy = false;
          return;
        }

        // 4. UPDATE pieces : pages jsonb avec les CHEMINS storage capturés (pas d'URL signée).
        const pagesJson = this.pages.map((p, i) => ({
          numero: i + 1,
          path_storage_input: `galactus-input/${inputKeys[i]}`,
          media_type: p.mediaType,
        }));

        try {
          await sb.updatePiece(inserted.id, { pages: pagesJson });
        } catch (err) {
          console.warn('[INGESTION] UPDATE pages partiellement échoué', { message: err.message });
          // Non-bloquant : la pièce est en DB, justificatif_path déjà posé à l'INSERT.
        }

        toast(`Pièce validée — ${outputFilename}`, 'success');

        // 5. Suite : rafale ou terminer
        if (continueRafale) {
          this.rafaleCount++;
          if (!this.isRafale) this.enterRafale();
          this.resetForm();
          this.subview = 'home';
        } else {
          this.resetForm();
          this.exitRafale();
          // Navigation via app shell
          if (window.app && typeof window.app === 'function') {
            // Pas exposé directement, on passe par hashchange
          }
          location.hash = '#/pieces';
        }
      } finally {
        this.busy = false;
      }
    },

    // ====================================================================
    // === RESET ==========================================================
    // ====================================================================

    resetForm() {
      // Libère les blob URLs
      this.pages.forEach(p => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      this.pages = [];
      this.currentPreviewPage = 0;
      this.hint = { categorie: null, activite: null };
      this.formData = {
        date_piece: '',
        fournisseur: '',
        fournisseur_slug: '',
        reference_fournisseur: '',
        montant_ht: null,
        montant_tva: null,
        montant_ttc: null,
        taux_tva: 20,
        taux_tva_choice: '20',
        categorie: null,
        activite: null,
        description: '',
        confiance_ocr: 0,
      };
      this.confidencePerField = { fournisseur: 0, date: 0, montant: 0, categorie: 0, activite: 0 };
      this.ocrTextBrut = '';
      this.fileHash = null;
      this.doublon = { open: false, existing: null };
    },
  };
};
