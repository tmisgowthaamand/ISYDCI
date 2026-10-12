# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

No linter or test suite is configured.

## Architecture

Single-page React 18 app built with Vite + Tailwind CSS v4 (via `@tailwindcss/vite` plugin). React Router v7 handles client-side routing; Vercel rewrites all paths to `/` for SPA support.

**Routing** — `src/App.jsx` defines all routes. Every page is wrapped in `src/components/Layout.jsx` (Navbar + Outlet + Footer).

**Pages** — one file per route in `src/pages/`. `PageHeader.jsx` is a shared hero banner used at the top of interior pages.

**Data layer** — no backend. All editable content lives in two files:
- `src/data/members.js` — athlete roster; add entries here when transcribing member registration forms. Each object must include `id`, `name`, `age`, `sport`, `state`, `gender`. Optional: `photo` (path under `/public/athletes/`), `medals`, `extra`.
- `src/data/site.js` — nav links, pillar definitions, and gallery image list.

**Styling** — Tailwind utility classes throughout. Custom theme tokens are in `src/index.css` under `@theme`:
- `--color-navy` / `--color-navy-2` — dark blue background shades
- `--color-accent` / `--color-accent-2` — green accent shades
- Helper classes: `.text-gradient`, `.num-gradient`, `.btn-gradient`, `.shimmer` skeleton animation

**Static assets** — `public/athletes/` (athlete photos, referenced as `/athletes/N.png`) and `public/events/` (event gallery, 12 images referenced as `/events/N.png`).

## Deployment

Deployed on Vercel. `vercel.json` rewrites all routes to `/` for client-side routing. Push to the connected branch to deploy.
