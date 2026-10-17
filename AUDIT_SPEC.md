# ISYDCI Web & WhatsApp Flow Audit Specification

## 1. Scope of Audit
This audit tests the end-to-end functionality of the ISYDCI system across both Web and WhatsApp channels:
- **WACTO Flow Engine**: Validation of `src/data/isydci_flow_v1.json` for node reachability, edge keywords, and WhatsApp limits.
- **Unregistered Athlete Journey**: 5-step interactive onboarding flow from greeting to card issuance.
- **Registered Athlete Journey**: Automated recognition, welcome greeting, and Front/Back card delivery without data omissions.
- **Backend API & Database**: Data consistency in `backend/data/members.json` and REST endpoints on `http://localhost:5000`.
- **Frontend Web Application**: Production build integrity and Admin Panel simulation.

---

## 2. Test Execution Plan

### Step 1: WACTO Flow Structural Audit
Run flow verification scripts to check:
1. Every non-root node has at least one incoming edge.
2. WhatsApp hard limits:
   - Button titles &le; 20 characters (maximum 3 buttons per message).
   - List row titles &le; 24 characters (maximum 10 rows per list).
   - List section titles &le; 24 characters.
   - Message body &le; 1024 characters.

### Step 2: Unregistered Athlete Registration Flow
Verify the conversational state machine:
- **Root Menu**: "Register Athlete" option available.
- **Step 1/5**: Full Name input.
- **Step 2/5**: Date of Birth & Age selection.
- **Step 3/5**: Indian State selection (10 states / UTs categorized into regions).
- **Step 4/5**: District, Assembly Constituency & Zone input.
- **Step 5/5**: Passport Photo upload (137&times;136 aspect ratio).
- **Card Issuance**: Generation of dual-sided official card with unique ID.

### Step 3: Registered Athlete Flow & Card Integrity
Verify athlete records:
- **LOKESH** (`ISYDCI-2D6C69F9`, Phone: `8218213212`): Full accreditation, Cloudinary front & back cards.
- **KARTHIK RAJA** (`ISYDCI-99B9291B`, Phone: `9988776655`): All back-side fields populated (DOB, Age, Blood Group, Address, District, Assembly).
- Verified welcome message display with no blank dashes (`—`).

### Step 4: Backend API & Service Health
Execute live health and query checks against `http://localhost:5000`:
- `GET /api/health` &rarr; Status OK, Cloudinary & Admin configuration.
- `GET /api/members` &rarr; Returns verified athlete list.
- `GET /api/members/phone/:phone` &rarr; Instant lookup for returning member flow.

### Step 5: Web Application Production Build
Compile frontend via `npm run build` to ensure zero compilation or bundling errors.
