# CV Generator

Variant-centric React app for building cover letters, CVs, and portfolios, with high-quality PDF export.

## Quick start

```bat
start.bat
```

Or:

```bash
npm install
npm start
```

- App: http://127.0.0.1:5173  
- API + export: http://127.0.0.1:3001  

## How to use

1. Open the **burger menu** (top left) to pick a variant.
2. **Default template** is first — company-neutral cover / CV / portfolio.
3. Select **Breville** (or any company variant) to load that package.
4. Use the **tabs** to switch Cover / CV / Portfolio for the active variant.
5. Edit in the right panel (structured fields or **Advanced JSON**), then **Save**.
6. **Add variant** clones an existing package into a new editable config.
7. **Export PDF** chooses which documents to include for the active variant.

## Content on disk

| Kind | Path |
|------|------|
| Cover | `content/cover/{id}.json` |
| CV | `content/cv/{id}/…` |
| Portfolio | `content/portfolio/{id}.json` |
| Shared identity (covers) | `content/shared/profile.json` |
| Variants index | `content/app/variants.json` |
| SQLite catalog | `data/cv-generator.db` (local; gitignored) |

React UI lives in `src/`. Documents render as React components from JSON (live preview while editing).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` / `npm run dev` | Vite UI + API/export server |
| `npm run build` | Production Vite build → `dist/` |
| `npm run export-server` | API + PDF only |
