# ISYDCI WACTO WhatsApp Integration Skill & Adapter Specification

This guide documents the WACTO WhatsApp flow integration for **ISYDCI (Indian Sports Youth Development Council of India)**.
It follows the global `wacto-flow` standard registered at `~/.gemini/config/skills/wacto-flow/`.

---

## 1. Project Overview

- **Project**: ISYDCI (Indian Sports Youth Development Council of India)
- **Frontend**: [https://isydci.vercel.app/](https://isydci.vercel.app/) (React 18 + Vite + Tailwind CSS v4)
- **Backend API**: [https://isydci.onrender.com](https://isydci.onrender.com) (Node.js Express, port 5000)
- **Database**: `backend/data/members.json` via `backend/db/db.js`
- **Cloud Assets**: Cloudinary for Athlete Photos & Combined Front/Back ID Cards (`isydci/members/<USERNAME>/`)
- **ID Card Renderer**: `id-card-template.html`

---

## 2. WACTO WhatsApp Architecture

### Core Endpoints & Base Configuration
- **WACTO API Base**: `https://backend.wacto.ai/api/v1.0`
- **Authentication**: `Authorization: Bearer <WACTO_API_KEY>`
- **Webhook Endpoint**: `POST /api/whatsapp/wacto` (in `backend/server.js`)
- **Sending Number**: Configured via `WACTO_CHANNEL` in `backend/.env`

> [!IMPORTANT]
> **Single Connected Number Rule**: Ensure only ONE active phone number is connected in your WACTO account (`GET /channels`). Having multiple active numbers causes WACTO outgoing messages to fail with `Session is not opened!`.

---

## 3. Label Routing Specification

WACTO matches button taps and keyword text globally. Routing is categorized as:

| Routing Kind | Labels / Keywords | Handler / Description |
|---|---|---|
| **backend_only** | `Verify Membership`<br>`Download ID Card`<br>`My Registration`<br>`Submit UTR`<br>`Check Draw Number`<br>`Contact Support` | Intercepted directly by backend webhook.<br>Fetches live data from `backend/db/db.js` or sends Cloudinary media. |
| **dual** | `Register`<br>`Membership Card`<br>`Upcoming Events`<br>`Tournament Info`<br>`Athletes Roster` | Triggers both WACTO flow branches and backend analytics/logging. |
| **opens_wacto** | `Main Menu`<br>`Select Sport`<br>`Select State` | Quick reply buttons sent by backend to return user back into WACTO interactive nodes. |

---

## 4. Key Workflows

### A. Athlete / Member Verification
1. User enters Member ID (e.g. `ISYDCI-684DDC04`) or mobile number in WhatsApp chat.
2. Webhook queries `getMemberById()` or searches by contact number.
3. Bot responds with formatted member card:
   - Name, Sport, State, District, Member ID, Status (Verified).
   - Interactive button: `[Download ID Card]`.

### B. Instant Digital ID Card Delivery
1. User taps `Download ID Card`.
2. Backend gets stored `cardFullUrl` from member record (Cloudinary PNG).
3. Backend calls WACTO API:
   ```http
   POST https://backend.wacto.ai/api/v1.0/messages/send-image/{channel-number}
   Authorization: Bearer <WACTO_API_KEY>
   Content-Type: application/json

   {
     "to": "91XXXXXXXXXX",
     "link": "https://res.cloudinary.com/.../id_card_full.png",
     "caption": "Official ISYDCI Athlete ID Card\nMember: Amit Kumar\nID: ISYDCI-684DDC04\nStatus: Verified ✅"
   }
   ```

### C. Tournament Entry & Draw Number
1. Athlete registers for national championship / trials (entry fee ₹2,000).
2. Bot displays official UPI payment details & QR.
3. Athlete replies with UTR / payment screenshot.
4. Backend assigns tournament draw number and confirms spot.

---

## 5. WhatsApp Technical Constraints

- **Message Text Body**: Max 1,024 characters.
- **Quick Reply Buttons**: Max 3 buttons, max 20 characters per button title.
- **List Picker Rows**: Max 10 rows per section, max 24 characters per row title, description max 72 characters.
- **Image Media**: Max 5 MB (PNG / JPEG).
- **Video Media**: Max 16 MB (H.264 Main profile + AAC audio).
- **24-Hour Rule**: Use standard messages within 24h of user inbound message; use pre-approved Meta Templates (`send-template`) outside 24h.

---

## 6. Offline Validation & Gate Commands

Before importing any new WACTO JSON flow into the dashboard:

```bash
# 1. Structure & unreachable node check
python C:\Users\Admin\.gemini\config\skills\wacto-flow\scripts\verify_flow.py <flow.json>

# 2. Route check against ISYDCI labels
python C:\Users\Admin\.gemini\config\skills\wacto-flow\scripts\route_check.py <flow.json> --backend C:\Users\Admin\.gemini\config\skills\wacto-flow\adapters\isydci.labels.json

# 3. Privacy check (flags any real mobile numbers, credentials or keys)
python C:\Users\Admin\.gemini\config\skills\wacto-flow\scripts\privacy_scan.py <flow.json>
```
