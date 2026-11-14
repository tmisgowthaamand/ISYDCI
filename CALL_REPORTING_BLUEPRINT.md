# ISDYCI — WhatsApp Business Calling & Analytics Blueprint

## Audit Snapshot: Current Stack
- **Database:** **MongoDB** (`mongodb` `6.12.0` in `backend/package.json`) — reporting should use **MongoDB Aggregation Pipelines** (`$match`, `$group`, `$facet`, `$bucket`, `$dateToString`), not SQL.
- **Calling & Recordings:** `backend/services/calling.js` uses Meta Graph API `v24.0` with `META_RECORDING_CONFIG` enabled (`en_US`, `"quality assurance and training"`). Recordings (`.ogg` from Meta + `.webm` from browser WebRTC) are saved in `backend/protected_recordings/` and streamed via `GET /api/calls/:callId/recording` (`206` byte-range).
- **AI / Queues / UI:**
  - `backend/package.json` and `backend/.env` have **no LLM/STT SDK** (`@google/genai`, `openai`, etc.) and **no background job queue** (`bullmq`, `agenda`, Redis).
  - `package.json` has React `18.3.1`, Tailwind CSS `4.2.4`, `html-to-image`, and `html2canvas`, with **no charting library** (`recharts`/`chart.js`) or PDF library installed.
  - Existing dashboards (`src/pages/AdminDashboard.jsx`) use pure Tailwind KPI cards, and `src/pages/AdminLeads.jsx` already uses the `apiFetch('/api/leads/export?...')` CSV download pattern.

---

## 1. Current Data Readiness Matrix

| Data / Capability | Current Status in Codebase | Meta Calling API Capability | Gap / Action Needed |
| :--- | :--- | :--- | :--- |
| **Call Lifecycle** (`callId`, `waId`, `direction`/`call_direction`, `status`, `attended`, `startedAt`, `answeredAt`, `endedAt`, `durationSec`/`duration_seconds`, `endReason`) | **Captured** in `whatsapp_calls` | `calls` webhook (`connect`, `terminate`, statuses) | Ready for immediate MongoDB aggregation |
| **Agent & Lead Attribution** (`telecaller_id`, `leadId`, `memberId`, `leadName`) | **Captured** in `whatsapp_calls`; `leads` also stores `district`, `state`, `campaign.adId` | — | `$lookup` between `whatsapp_calls` and `leads` unlocks locality & ad-campaign call ROI |
| **Call Permissions & 72h Window** (`status`, `isPermanent`, `permissionExpiresAt`, `lastRequestAt`, `requestTimestamps`, `lastReplyAt`) | **Captured** in `call_permissions` | `call_permission_reply` webhook | Ready for immediate funnel & 72-hour window utilization reporting |
| **Call Recordings** (`recording_media_id`, `recording_status`, `recording_file`, `recordingMimeType`, `recordingSizeBytes`) | **Captured** in `whatsapp_calls` + disk `.ogg`/`.webm` | `call_recording_available` webhook + Graph API media download | Ready for audio-based AI processing |
| **Native Meta Transcription** (`transcript` field in `whatsapp_calls`) | **Placeholder only** (`transcript: null`); `backend/routes/whatsappWebhook.js` handles `calls`, templates, and `messages` — **not** `call_transcription` | Opt-in `transcription` request config (separate from recording, plays its own disclosure) + `call_transcription` webhook delivering a `media_asset_id` / `media ID` to fetch JSON transcript | Subscribe to `call_transcription` webhook field + opt in on call connect/accept if you want Meta's native transcripts (note: verify regional Indian language accuracy vs. Gemini audio) |
| **WABA-Level Call Analytics** | **Not fetched** | Graph API Analytics endpoint / WhatsApp Manager call metrics | Optional periodic sync for Meta-side billing/rate-limit reconciliation |
| **AI Intelligence Fields** (`summary`, `sentiment`, `intent`, `qaScore`, `actionItems`, `aiStatus`) | **Not present** | — | Add `aiAnalysis` subdocument + processing status to `whatsapp_calls` |

---

## 2. Tier 1 — Instant Operational & Telephony Reports (Zero AI Cost)

All of these can be built **immediately** with MongoDB aggregation pipelines on `whatsapp_calls`, `call_permissions`, `leads`, and `admins` — zero external API cost:

1. **Executive Call Volume & Answer Rate (Inbound vs. Outbound)**
   - **Metrics:** Total calls, Answered (`attended: true` / `completed`), Missed (`missed`), Rejected (`rejected`), Failed (`failed`), Answer Rate %, Inbound vs. Outbound split.
   - **Aggregation:** `$match` by date range + `$facet` grouping by `direction` and `status`, plus `$dateToString` (`%Y-%m-%d` in `Asia/Kolkata`) for daily trend bars.
2. **Peak Hour & Missed-Call Heatmap**
   - **Metrics:** Hourly call volume vs. missed-call spikes (`$hour` with timezone `Asia/Kolkata` on `startedAt`) to identify staffing gaps when incoming calls go unanswered.
3. **Average Handle Time (AHT) & Ring-to-Answer Latency**
   - **Metrics:** Avg/median/p95 `durationSec` on completed calls, plus ring latency (`answeredAt - startedAt`) and `endReason` breakdown (caller hangup vs. agent hangup vs. timeout/error).
4. **Telecaller Leaderboard & Compliance Scorecard**
   - **Metrics per `telecaller_id`:** Assigned leads count, Outbound calls attempted, Outbound pickup rate, Inbound calls answered vs. missed, Total talk time, Avg duration, and Recording coverage (`recording_status: 'ready'` %).
   - **Visibility:** Super Admin / Super Super Admin sees all telecallers; each telecaller sees only their own stats on their dashboard.
5. **Call Permission Conversion & 72-Hour Free Window Utilization**
   - **Metrics from `call_permissions` + `whatsapp_calls`:** Permission requests sent (`requestTimestamps` count) -> Accepted vs. Rejected conversion %, Permanent vs. 72-hour temporary grants, and **Window Utilization** (how many accepted 72h windows actually received an outbound call before `permissionExpiresAt` expired, plus expiring-soon alerts).
6. **Locality & Campaign Attribution Report**
   - **Metrics:** `$lookup` `whatsapp_calls.leadId` -> `leads` to break down call volume, pickup rate, and lead progression (`registered` / `card_issued`) by `district`, `state`, and `source` (`ctwa_ad`, `facebook_lead_ad`, `whatsapp_flow`).
7. **CSV Export**
   - Follow the exact pattern in `src/pages/AdminLeads.jsx` with `GET /api/calls/export` for filtered call logs and telecaller summaries.

---

## 3. Tier 2 — AI Conversation Intelligence & QA Reports (Audio/Transcript Powered)

Because your telecallers and leads may speak **regional Indian languages and code-mixed speech** (e.g., Tamil/Hindi/English), sending the saved `.ogg`/`.webm` audio directly to a multimodal model like **Gemini (`@google/genai`)** avoids double-error from a separate English-centric STT step (or you can use Meta's native `call_transcription` JSON when sufficient).

### Per-Call Structured Extraction (`whatsapp_calls.aiAnalysis`)
When `recording_status` becomes `'ready'`, an async worker (persisting `aiAnalysis.status`: `pending` | `processing` | `done` | `failed` in MongoDB so no Redis/BullMQ is required initially) extracts strict JSON:
- `language_detected`: e.g., `ta`, `hi`, `en`, `ta-en`
- `transcript_translated_en`: concise English summary/turn-by-turn gist
- `caller_intent`: e.g., `sports_registration_help`, `id_card_status`, `grievance`, `pricing_enquiry`, `callback_request`, `wrong_number`
- `sentiment`: `positive` | `neutral` | `frustrated` | `urgent` (plus `sentiment_score` 1–5)
- `qa_scorecard`: `{ greeting: bool, verified_details: bool, explained_next_steps: bool, polite_tone: bool, overall_score: 0-100 }`
- `action_items`: array of follow-ups + `escalation_required: bool` + `escalation_reason`

### Aggregated Supervisor Reports
1. **Top Caller Intents & Grievance Breakdown by District/Source:** Which regions or ad campaigns generate the most registration drop-off questions or complaints.
2. **Telecaller QA & Script Compliance Leaderboard:** Average QA score per telecaller + flagged low-score or `frustrated`/`escalation_required` calls with 1-click inline audio playback (`GET /api/calls/:callId/recording`).
3. **Automated Follow-Up & Escalation Queue:** Live inbox filter/tab of calls where `escalation_required === true` or `action_items` remain unresolved.
4. **Daily Executive Digest:** Scheduled summary (e.g., 8:00 PM IST) of call KPIs, top 3 recurring issues, and flagged QA calls.

---

## 4. Recommended Implementation Roadmap

1. **Phase 1 — Tier 1 Backend & Indexes (Zero AI Cost):**
   - Add MongoDB indexes on `whatsapp_calls` (`startedAt`, `telecaller_id`, `direction`, `status`, `leadId`) and `call_permissions` (`status`, `permissionExpiresAt`).
   - Build `backend/services/callReports.js` + `GET /api/reports/calls` (summary, hourly heatmap, telecaller leaderboard, permission funnel, district breakdown) and `GET /api/calls/export` (CSV).
2. **Phase 2 — Tier 1 Frontend UI:**
   - Add a **Call Reports** page (`/admin/reports/calls`) matching your existing Tailwind card/table design (using lightweight SVG/CSS bar & heatmap components so no heavy charting dependency is required, or optionally adding `recharts`).
   - Scope telecaller views so each telecaller sees only their own call metrics.
3. **Phase 3 — Meta `call_transcription` Webhook (Optional Free Meta Metadata):**
   - Add `change.field === 'call_transcription'` handling in `backend/routes/whatsappWebhook.js` and download/store the JSON transcript into `whatsapp_calls.transcript`.
4. **Phase 4 — Tier 2 AI Pipeline & QA Views:**
   - Install `@google/genai` and configure `GEMINI_API_KEY` in `backend/.env`.
   - Trigger async audio analysis right after `recording_status = 'ready'`, store `aiAnalysis` on `whatsapp_calls`, and surface QA scorecards + Escalation Queue in the Call Reports UI.
