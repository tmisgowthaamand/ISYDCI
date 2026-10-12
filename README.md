# ISYDCI Website

Official website for the **International Sports & Youth Development Campaign of India**.

## Stack
- Vite + React 18
- Vanilla CSS (theme inspired by kheloindia.gov.in — navy + saffron)

## Run locally
```bash
cd isydc-web
npm install
npm run dev
```
Open http://localhost:5173

## Build for production
```bash
npm run build
npm run preview
```

## Structure
- `src/App.jsx` — all page sections (Navbar, Hero, About, Pillars, Founder, Gallery, Members, Contact, Footer)
- `src/data/members.js` — registered athletes (edit to add/update details from member forms)
- `public/events/` — event gallery images (1.jpeg … 12.jpeg)

## Editing member data
When scanned forms are transcribed, update `src/data/members.js` with the same schema used for T.K. Sajeev.
