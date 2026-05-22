# Galactus — Journal des décisions techniques (append-only)

Une entrée par décision structurante. Datée. Avec **Raison** + **Conséquence si on change**. Ne jamais modifier une entrée existante — ajouter une nouvelle entrée si la décision évolue.

---

## 2026-05-22 — Décisions Sprint 0

### 1. Rebuild propre vs migration progressive → **rebuild**

- **Raison** : architecture monolithe HTML legacy (vues Saisie/Tableau/Documents, palette TDM v1.1 terracotta, fonts Spectral) radicalement incompatible avec la cible (4 vues, palette cosmic/magenta, Alpine modulaire). Migration progressive aurait imposé une double maintenance.
- **Conséquence si on change** : impossible de revenir en arrière sans réécrire l'archive `archive/index-legacy-frais-tournage.html`.

### 2. Bundle wireframes Claude Design → `design-handoff/` gitignored

- **Raison** : 1.2 MB de références visuelles (wire.jsx, screens-*.jsx, uploads/), pas pertinent à versionner dans le repo.
- **Conséquence si on change** : si Pierre change de machine, re-extraire `~/Downloads/Galactus-handoff.zip` dans `design-handoff/`.

### 3. Rename dossier local `TDMstudio-frais-tournage/` → `galactus/`

- **Raison** : cohérence avec le rename GitHub effectué pré-Sprint 0.
- **Conséquence si on change** : raccourcis IDE/shell à adapter, anciens chemins absolus dans scripts Pierre potentiellement à corriger.

### 4. Hash de déduplication : MD5 → **SHA-256**

- **Raison** : Web Crypto SubtleCrypto n'expose pas MD5 nativement. Inclure une mini-lib MD5 externe pour un seul usage = dette inutile.
- **Conséquence si on change** : si Pierre veut comparer un hash galactus à un MD5 calculé par un outil externe, incompatible. Le schéma DB conserve la colonne `pieces.hash_md5` (nom legacy) mais le contenu est en réalité SHA-256. À documenter explicitement dans `js/utils.js` au Sprint 1.

### 5. Variante mobile Ingestion = **A** (2 gros boutons)

- **Raison** : variante A (`IngestionHomeMobileA` du bundle wireframes) = 2 gros boutons "📷 Prendre en photo" / "📎 Choisir un fichier". Choix arbitré session design 2026-05-21.
- **Conséquence si on change** : la variante B (caméra-first plein écran avec corner brackets) est reportée Sprint 5 polish pour évaluation après usage S1 tournage.

### 6. Source de vérité migrations DB = **Supabase**, pas dual

- **Raison** : MCP `apply_migration` génère lui-même les fichiers côté Supabase. Dupliquer en local = risque de désync.
- **Conséquence si on change** : les 6 fichiers SQL locaux dans `supabase/migrations/` (timestamps Supabase officiels) sont la copie miroir Sprint 0 — pour permettre `supabase db pull` futur si CLI installée.

### 7. Buckets Storage `galactus-input` + `galactus-output` = **privés** avec policies anon full access

- **Raison** : cohérence sécu avec le sprint RLS parallèle (transition future vers authenticated user only). Aujourd'hui : policies anon calquées sur `justificatifs-frais` legacy (le pattern actuel du projet).
- **Conséquence si on change** : Sprint sécu RLS S23-24 durcira les policies (restriction à `auth.uid()` du compte Pierre). Sprint 3 vue Pièces utilisera des **signed URLs** pour servir les images (les URLs `/object/public/galactus-input/...` ne fonctionneront pas sur bucket privé en lecture).

### 8. Migration des 14 justificatifs legacy = **dès Sprint 0** via API HTTP

- **Raison** : éviter dette cohabitation entre 3 buckets. Téléchargement via URLs publiques `justificatifs-frais` + re-upload via API anon dans `galactus-input` (les policies anon insert créées Sprint 0 le permettent).
- **Conséquence si on change** : `justificatifs-frais` reste actif comme backup 3 mois (drop programmé 2026-08-22). Si rollback nécessaire avant 3 mois, UPDATE inverse dispo dans migration 06.
