# ⭐ Star Icons

**The icon collection manager for Obsidian** — 13,700+ icons bundled offline, organized into collections and tags, and applied to files, folders and tabs through an intuitive rules engine with live preview and full transparency.

Star Icons takes a third path in the icon-plugin landscape:

- **Iconize** gives you total manual control.
- **AutoIcons** gives you set-and-forget automation.
- **Star Icons** gives you a *library*: curate, tag and collect icons like music playlists, then apply them with rules that explain themselves.

![Icon Manager](https://img.shields.io/badge/manager-13.7k%20icons-%23f5b301) ![Offline](https://img.shields.io/badge/offline-first-yes-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

### 🗂️ Icon Collection Manager (the hub)
A dedicated sidebar view — *the* place to browse your icons.

- **13,724 icons bundled offline** — no network requests, ever:
  - **Lucide** (2,025) — the de-facto Obsidian icon set, with official tags
  - **Tabler** (5,130) — modern outline icons with official categories & tags
  - **Bootstrap Icons** (2,078) — crisp, rounded web icons
  - **Remix Icon** (1,539) — 20 categories of line icons
  - **Phosphor** (1,512) — geometric, family-weight icons
  - **Unicons** (1,215) — Iconscout line-style icons
  - **Material Symbols** (225) — curated subset, rounded weight
  - **Star Icons** (14) — original, hand-crafted star designs
- Search with fuzzy matching across names and tags
- Filter by pack, or by **your own tags**
- **Collections**: drag icons in, reorder with drag & drop, rename, delete
- **Favorites** and **recently used** strips in the picker
- Detail panel: big preview, tags editor, collection membership, copy name/SVG, *apply to the active note*

### 🎛️ Rules engine that explains itself
Rules run **top-to-bottom** and the first enabled match wins — but unlike other plugins, you always know *why* an icon is there.

- **Conditions**: file name · file path · extension · folder · tag · property · heading · **and the system clock** (day of week + time window)
- Match **all** or **any** conditions
- Actions: set an icon · random icon from a collection · use Obsidian's default
- **Live preview**: watch matching files appear as you build the rule
- **Drag & drop reordering**, enable/disable per rule
- **Icon source tooltips**: hover any file to see which icon applies and which rule decided it
- Status bar indicator shows the active note's icon + source

### 📐 Priority that's predictable

```
Manual override  >  Rules (in order)  >  File-type default  >  Global default
```

### 🖱️ Apply icons everywhere
- **File explorer**: files *and* folders
- **Tab headers** of open notes
- **Above the note title** (reading view, optionally edit mode)
- Right-click any file → *Set icon…* / *Copy icon name* / *Remove icon override*
- Command palette commands + a ribbon button
- Manual overrides, file-type defaults (`.md`, `.pdf`, …) and a global default

### 🧰 And more
- Pack on/off toggles (instantly shrinks search space)
- Export / import your whole configuration as JSON
- Settings reset, keyboard-navigable icon picker, dark/light theme aware
- Zero dependencies beyond the Obsidian API — bundled icons, bundled everything

---

## 🚀 Getting started

### From the community plugin store
1. Settings → Community plugins → Browse → search **"Star Icons"** → Install → Enable.

### Manual install (from source)
1. Download `main.js`, `manifest.json`, `styles.css` from the latest release.
2. Copy them into `<vault>/.obsidian/plugins/star-icons/`.
3. Reload Obsidian and enable **Star Icons**.

### Development
```bash
npm install
npm run dev        # watch mode (esbuild)
npm run build      # production build -> main.js
npm test           # rule engine unit tests
npm run build:icons# regenerate src/data/generated/*.json from node_modules packs
```

---

## 📖 Rules deep-dive

| Condition | What it checks | Example |
| --- | --- | --- |
| File name | the note's basename | `contains "journal"` |
| File path | full vault-relative path | `starts with "Projects/"` |
| Extension | the file type | `is in "md, pdf, png"` |
| Folder | the parent folder | `is in "Daily Notes/2025"` |
| Tag | tags from frontmatter/inline | `equals "todo"` |
| Property | any frontmatter property | `status equals "active"` |
| Heading | headings inside the note | `starts with "Chapter"` |
| Time | day of week + 24h window | `Mon–Fri, 09:00–17:00` |

Rules are evaluated in order; the first **enabled** rule whose conditions match wins.
Drag rules to reorder, toggle them off without deleting, and use the live
preview to sanity-check before saving.

> 💡 Tip: combine a `folder` rule with a **random** action and a collection of
> 20 icons — every project folder gets its own rotating icon.

---

## 🧭 Philosophy

1. **Library first.** Icons are content. Tag them, collect them, curate them.
2. **Transparency.** Every icon on screen can explain its own provenance.
3. **Offline & fast.** No fetch, no CDN, no waiting.
4. **Native feel.** Icons follow Lucide's design guidelines (24×24, 2px stroke,
   round caps) so they sit naturally inside Obsidian.

---

## 📦 Icon packs

| Pack | Count | Version | Source |
| --- | --- | --- | --- |
| Lucide | 2,025 | 1.31.0 | [lucide.dev](https://lucide.dev) (ISC) |
| Tabler | 5,130 | 3.46.0 | [tabler.io/icons](https://tabler.io/icons) (MIT) |
| Bootstrap Icons | 2,078 | 1.13.1 | [icons.getbootstrap.com](https://icons.getbootstrap.com) (MIT) |
| Remix Icon | 1,539 | 4.9.1 | [remixicon.com](https://remixicon.com) (Apache 2.0) |
| Phosphor | 1,512 | 2.1.1 | [phosphoricons.com](https://phosphoricons.com) (MIT) |
| Unicons | 1,215 | 4.2.0 | [iconscout.com/unicons](https://iconscout.com/unicons) (Apache 2.0) |
| Material Symbols | 225 | 0.46.0 | [Google Fonts](https://fonts.google.com/icons) (Apache 2.0) |
| Star Icons | 14 | 1.0.0 | original (MIT) |

---

## 🤝 Contributing

- **Report bugs** & request features via GitHub issues.
- **Add icons**: edit `src/data/packs/star.ts` (24×24 stroke-style SVGs) and open a PR.
- **Add packs**: extend `scripts/build-icon-data.mjs` and re-run `npm run build:icons`.

Star Icons is open source (MIT) — like the plugins it learns from
([Iconize](https://github.com/FlorianWoelki/obsidian-iconize),
[Iconic](https://github.com/ram02z/obsidian-iconic), [AutoIcons](https://github.com/NotPunchnox/obsidian-auto-icons)).

---

## 📜 License

MIT © Star Icons. Bundled icon packs retain their respective licenses (see above).
