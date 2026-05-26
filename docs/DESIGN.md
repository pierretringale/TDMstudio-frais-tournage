# Galactus — Design System

Référence visuelle Sprint 1+. La page `#/_demo` (cachée de la nav) rend tous les composants en live — ouvrir `http://localhost:8000/#/_demo` pour vérification croisée vs maquettes.

---

## Palette (20 couleurs)

### Neutres papier / encre (9)

| Token | Hex | Usage |
|---|---|---|
| `paper` | `#fffdf6` | Fond app principal (jaune-blanc très subtil) |
| `soft` | `#fbf8ec` | Hover btn ghost, fonds secondaires |
| `fill` | `#f4f0de` | Fonds tertiaires, sections distinctes |
| `rule` | `#d9d4be` | Bordures cards / fields neutres |
| `faint` | `#a6a18a` | Texte décoratif (sub-labels, palette mid) |
| `mid` | `#6f6b58` | Texte secondaire (labels, captions) |
| `ink` | `#1e1d18` | Texte primaire, bordures fortes, btn primary |
| `void` | `#0a0a1f` | Fond cosmic foncé (sidebar) |
| `cosmos` | `#050513` | Fond cosmic profond (bordure nebula) |

### Accents magenta/violet (4)

| Token | Hex | Usage |
|---|---|---|
| `accent` | `#ff1f6d` | **Couleur signature** — boutons action, KPI accent, badge vente, glow |
| `accent-soft` | `#ff5f9c` | Hover accent, étoiles nebula |
| `hot` | `#ff4d3d` | Top gradient AccentBtn (du chaud vers magenta) |
| `violet` | `#8b3dff` | Halo nebula, badge matériel |

### Couleurs secondaires (3)

| Token | Hex | Usage |
|---|---|---|
| `cyan` | `#00d4ff` | Badge ndf-mois, badge act-mix |
| `gold` | `#ffc857` | Branding (sub-text), badge act-vum, avatar Pierre |
| `orange` | `#ff8c42` | Badge catégorie ndf |

### Sémantique (4)

| Token | Hex | Usage |
|---|---|---|
| `green` | `#00e676` | Statut uploadé Indy, badge confidence high, success toast |
| `amber` | `#ffb300` | Statut à traiter, badge confidence mid, warning |
| `red` | `#ff3838` | Erreurs, badge confidence low |
| `blue` | `#3b82f6` | Badge catégorie fournisseur |
| `yellow` | `#fde047` | Statut à traiter (pale) |

---

## Typographie

| Famille | Token Tailwind | Poids utilisés | Usage |
|---|---|---|---|
| **Inter** | `font-sans` | 400 / 500 / 600 / 700 / 800 / 900 | Body, labels, texte courant |
| **Big Shoulders Display** | `font-display` | 700 / 800 / 900 | Titres uppercase, KPI value, brand "GALACTUS" |
| **JetBrains Mono** | `font-mono` | 400 / 500 / 700 | Sub-labels, mono data, badges, slugs, filenames, hex codes |

Spécimens visuels : voir `#/_demo` section **1 · Typographie**.

**Pas Caveat** — la handwritten font n'est pas utilisée en galactus (exclue brief §1.3).

---

## Tokens spéciaux

### Nebula gradient

Background des sidebars / login / bannières cosmic.

```css
.nebula-gradient {
  background:
    radial-gradient(ellipse at 20% 10%, rgba(139,61,255,0.35) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(255,31,109,0.30) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 50%, rgba(0,212,255,0.15) 0%, transparent 60%),
    linear-gradient(180deg, #050513 0%, #0a0a1f 100%);
}
```

Tailwind utility : `bg-nebula`.

### Star field

À combiner avec `.nebula-gradient` pour effet étoilé (5 étoiles statiques, dont 2 colorées gold/accent-soft).

```html
<div class="nebula-gradient star-field"></div>
```

### Accent glow

Halo multi-couche magenta + violet pour boutons primaires / logo.

```css
.accent-glow {
  box-shadow:
    0 0 14px rgba(255, 31, 109, 0.65),
    0 0 30px rgba(139, 61, 255, 0.40),
    0 0 50px rgba(255, 31, 109, 0.20);
}
```

Tailwind utility : `shadow-glow-accent`.

### Logo halo

Gradient radial or → accent → violet pour le logo Galactus.

```css
.logo-halo {
  background: radial-gradient(circle at 30% 30%, #ffc857 0%, #ff1f6d 60%, #8b3dff 100%);
}
```

### Placeholder striped

Pour vues vides en attendant Sprint 2-4.

```css
.placeholder-striped {
  background-image: repeating-linear-gradient(45deg, transparent, transparent 8px,
    rgba(166, 161, 138, 0.18) 8px, rgba(166, 161, 138, 0.18) 16px);
  border: 1.5px dashed #d9d4be;
}
```

---

## Composants Tailwind (utility classes inline)

Pas de framework de composants, pas de web components custom. Tout est en classes utility composées directement dans le HTML.

### Btn standard

```html
<button class="border-[1.5px] border-ink text-ink font-bold uppercase tracking-wider px-4 py-2 rounded text-sm">
  Btn
</button>
```

### Accent Btn (action principale)

```html
<button class="bg-gradient-to-b from-hot to-accent text-white font-bold uppercase tracking-wider px-5 py-3 rounded shadow-glow-accent border-[1.5px] border-ink">
  Action
</button>
```

### Badge

```html
<span class="badge badge-cat-fournisseur">Fournisseur</span>
```

Classes disponibles :
- `badge-cat-{fournisseur|ndf|materiel|ndf-mois|vente}`
- `badge-act-{tdm|vum|mix}`
- `badge-status-{a_traiter|traite|uploade_indy|consolide_dans_ndf_mois|archive}`
- `badge-conf-{low|mid|high}`

### Field

```html
<div class="flex flex-col gap-1">
  <label class="text-[11px] font-mono uppercase tracking-wider text-mid">Label</label>
  <input class="border-[1.5px] border-ink rounded-sm px-3 py-2 font-mono text-sm bg-paper" />
</div>
```

### KPI card

```html
<div class="border-[1.5px] border-ink rounded-md p-4 bg-paper">
  <div class="font-mono text-[10px] uppercase tracking-wider text-mid">Label</div>
  <div class="kpi-value text-5xl mt-1">3 480 €</div>
  <div class="font-mono text-[10px] text-green mt-1">▲ +12 %</div>
</div>
```

La classe `.kpi-value` applique : Big Shoulders Display 900, `font-variant-numeric: tabular-nums`, letter-spacing -0.5px.

### Filter chip

```html
<span class="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded-full border border-ink text-ink">TDM</span>
```

Variante active : `bg-gradient-to-b from-hot to-accent text-white shadow-glow-accent`.

---

## Iconographie

Sprint 1 = pas de bibliothèque d'icônes externe. Les "icônes" tab bar mobile sont des placeholders géométriques en `border-2 border-ink` (carrés / pills).

Sprint 5 polish : décision à prendre — SVG inline custom (cosmic style) ou bibliothèque (Lucide / Phosphor). À documenter dans `galactus-decisions.md` quand arbitré.

---

## Responsive breakpoints (Tailwind défaut)

| Breakpoint | Min width | Comportement Galactus |
|---|---|---|
| (mobile) | 0 | Tab bar bottom, vues 1 colonne, padding 5 |
| `md:` | 768px | Sidebar 220px gauche, padding 8, grid multi-colonnes |
| `lg:` | 1024px | Inchangé sauf max-w des sections |
| `xl:` | 1280px | Inchangé |

Cible Pierre = iPhone (375px) et MacBook (1280px).
