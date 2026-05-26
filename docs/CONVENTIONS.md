# Galactus — Conventions métier

Référence pour Pierre et tout futur EC (expert-comptable) sur les choix structurants côté business / compta.

---

## Convention de nom de fichier

Tout PDF stocké dans `galactus-output` (Storage bucket des PDFs renommés finaux) suit ce pattern strict :

```
YYYY-MM-DD_fournisseur-slug_montantTTC_categorie_[TDM|VUM|MIX].pdf
```

### Composantes

| Champ | Source | Exemple |
|---|---|---|
| `YYYY-MM-DD` | Date de la pièce (`pieces.date_piece`) | `2026-05-14` |
| `fournisseur-slug` | `pieces.fournisseur_slug` (kebab-case, déterministe via `slugify()`) | `hotel-du-nord` |
| `montantTTC` | `pieces.montant_ttc`, 2 décimales, virgule décimale | `87,50` |
| `categorie` | 1 des 5 valeurs CHECK | `fournisseur` |
| `[TDM\|VUM\|MIX]` | 1 des 3 activités CHECK | `TDM` |

### Exemple complet

```
2026-05-14_hotel-du-nord_87,50_fournisseur_TDM.pdf
```

### Règles

- **Toujours `.pdf` en sortie**. Les pièces multi-pages (HEIC + JPG + PNG) sont consolidées en PDF unique par l'Edge Function avant écriture.
- Si un champ est manquant : fallback `sans-date`, `sans-fournisseur`, `0,00`, `sans-cat`, `TDM`.
- Slug toujours kebab-case, sans accents (`Hôtel du Nord` → `hotel-du-nord`).

---

## 5 Catégories (valeurs CHECK figées)

| Code | Description | Exemples |
|---|---|---|
| `fournisseur` | Factures fournisseur classiques (achat de service / abonnement direct entreprise) | OVH, Adobe, comptable, Squarespace |
| `ndf` | Note de frais individuelle Pierre — payée perso, remboursable | Restaurant client, taxi, hôtel tournage |
| `materiel` | Achat de matériel amortissable (caméra, ordi, accessoires) | Sony A7IV, MacBook, micro-cravate |
| `ndf-mois` | Pièce **synthèse** = consolidation des ndf du mois (générée par Galactus, pas saisie) | NDF mai 2026 = somme de 14 lignes ndf |
| `vente` | Facture émise client (revenus) | Facture TDM-2026-042 |

**Casse stricte** — minuscules. Une majuscule fait échouer l'INSERT en silence (contrainte CHECK Postgres).

---

## 3 Activités (valeurs CHECK figées)

| Code | Description | Critère d'affectation |
|---|---|---|
| `TDM` | TDM studio (formation, conseil, vidéo entreprise) | Mission TDM, client TDM, tournage TDM |
| `VUM` | vu.media (media / création de contenu propre) | Création vu.media, abonnement créa vu.media |
| `MIX` | Charge mutualisée entre TDM et vu.media (à ventiler comptablement) | Loyer studio, internet, comptable, ordi pro |

**Règle absolue** : chaque pièce doit avoir une activité affectée. Pas d'affectation possible plus tard → c'est au moment de la création.

### Cas frontières

- Café avec un client TDM en plein tournage → `TDM`
- Achat matériel utilisé 50/50 entre les 2 → `MIX`
- Restaurant pour brainstorm créa vu.media → `VUM`
- Abonnement Notion (gestion globale, utilisé pour les 2) → `MIX`

Heuristique : si la dépense est attribuable à 80 %+ à une activité → cette activité. Sinon → `MIX`.

---

## 5 Statuts (valeurs CHECK figées)

| Code | Description | Suivant |
|---|---|---|
| `a_traiter` | Pièce ingérée, OCR fait, attend validation Pierre | → `traite` (Sprint 2) |
| `traite` | Pierre a validé les champs OCR, pièce prête à être uploadée Indy | → `uploade_indy` ou `consolide_dans_ndf_mois` |
| `uploade_indy` | Pierre a uploadé manuellement le PDF dans Indy (workflow guidé Sprint 4) | → `archive` (J+90) |
| `consolide_dans_ndf_mois` | NDF individuelle absorbée dans la NDF mois synthèse | → `archive` (J+90) |
| `archive` | Conservée pour traçabilité, plus active dans les workflows | (terminal) |

### Workflow normal

```
a_traiter → traite → uploade_indy → archive (J+90)
                  ↘ consolide_dans_ndf_mois → archive (J+90)
```

**Casse stricte** — snake_case, minuscules.

---

## 3 Sources d'ingestion

| Source | Trigger | Sprint |
|---|---|---|
| `photo` | Caméra mobile (iPhone PWA), bouton "Prendre en photo" tab bar | Sprint 2 |
| `fichier` | Drag & drop ou bouton "Choisir un fichier" (PDF, image, multi-fichiers consolidés) | Sprint 2 |
| `email` | Forwarding inbox → trigger Edge Function (non MVP) | Post-MVP |

Sprint 2 implémente `photo` + `fichier` seulement.

---

## Hash de déduplication

Tout fichier uploadé est hashé en **SHA-256** (colonne DB `pieces.hash_md5` — nom legacy conservé, contenu réel SHA-256).

Voir `galactus-decisions.md` entrée 4 pour la raison.

Si `hash_md5 = existing` → on n'insère pas en double, on prévient Pierre avec un toast.

---

## Refacturations cas particuliers (NDF mois)

L'assistant NDF (Sprint 4) intègre automatiquement 2 refacturations mensuelles :

| Item | Montant | Calcul |
|---|---|---|
| Internet | 24 €/mois | 80 % de 29,99 € (forfait perso) |
| Téléphone | 8 €/mois | 50 % de 15,99 € (forfait perso) |

Note : IK voiture, loyer Clélia → **out of scope galactus**, géré par l'outil `remboursements` séparé.

---

## TVA

Galactus stocke HT / TVA / TTC séparés + activité. **Pas de quote-part TVA fine** côté galactus — Indy s'occupe de la règle comptable précise.

Cas pratique : si Pierre tape juste un montant TTC à 100 € sans préciser le taux, galactus stocke `montant_ttc=100, montant_tva=NULL, montant_ht=NULL`. Indy déduira.

---

## Domaine prod

`https://galactus.tdmstudio.fr` (cohérent `jarvis.tdmstudio.fr`). CNAME Squarespace → GitHub Pages (action Pierre Sprint 5).

**Les wireframes Claude Design affichent `galactus.tdm.studio` — ignorer, ce n'est pas le vrai domaine.** Voir `PROJET_galactus.md` ERREURS CONNUES.
