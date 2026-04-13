# Test Suite — Vehicle Maintenance Logger

Five layers of tests, from database up to full end-to-end on both phones.

---

## Quick start

```bash
# 1. Copy and fill in your credentials
cp .env.test.example .env.local

# 2. Install deps (if not already done)
npm install

# 3. Run each layer in order
```

---

## Layer 1 — Database (Supabase SQL)

**File:** `tests/layer1-database.sql`
**How:** Paste into Supabase → SQL Editor → Run

Tests: table structure, indexes, RLS policies, the mileage RPC, views, and cascade behavior.

Expected output: all queries return the noted result. The final cleanup query removes test rows.

---

## Layer 2 — API routes

**File:** `tests/layer2-api.js`
**How:**
```bash
# Terminal 1: start local dev server
npm run vercel-dev

# Terminal 2: run tests
node tests/layer2-api.js
```

Or against production:
```bash
TEST_BASE_URL=https://your-app.vercel.app node tests/layer2-api.js
```

Requires `TEST_EMAIL` and `TEST_PASSWORD` in `.env.local` — a real Supabase auth account.
The test creates real rows in your DB and cleans up after itself.

---

## Layer 3 — Claude parsing

**File:** `tests/layer3-claude-parsing.js`
**How:**
```bash
node tests/layer3-claude-parsing.js
```

Fires 15 realistic voice transcripts at Claude Haiku and validates the extracted fields.
No database writes — safe to run anytime.

Requires `ANTHROPIC_API_KEY` in `.env.local`.

Sample transcripts tested:
- Oil change (mileage + cost + shop name)
- Oil change with next-service reminder
- New tires
- Brake job with labor/parts split
- Fluid top-off
- Battery replacement
- State inspection
- Transmission fluid
- Minimal input ("oil change done")
- Wiper blades + cabin air filter
- Fuel fill-up (full details)
- Fuel — total cost only
- Premium fuel
- Diesel
- Ambiguous/garbled (should flag for review)

---

## Layer 4 — Cross-platform audio

**File:** `tests/layer4-audio-recorder.html`
**How:** Open in a browser — or serve it and open on your phones:

```bash
# Serve locally (accessible on your LAN)
npx serve tests/ -p 8080

# Then open on phone:
# http://YOUR_COMPUTER_IP:8080/layer4-audio-recorder.html
```

Or simply open the file directly in Chrome on desktop for a quick sanity check.

**What it tests:**
- MediaRecorder API support
- Best MIME type detection (webm on Android, mp4 on iOS)
- Microphone permission flow
- Recording start/stop
- Blob creation and size
- Playback in browser

Run on both phones. All 7 checklist items should turn green.

---

## Layer 5 — End-to-end (manual)

**File:** `tests/layer5-e2e-checklist.md`

Manual walkthrough after the frontend is deployed. 4 test sections:
- A: Android full flow (record → parse → edit → history)
- B: iOS full flow (mic permission, mp4 audio, cross-platform sync)
- C: Error handling (garbled audio, offline, long recording)
- D: Vehicle switching

Includes Supabase debug queries for investigating failures.

---

## .env.local variables needed

```env
# Supabase (from supabase.com → Settings → API)
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# For layer 2 tests only
TEST_EMAIL=your@email.com
TEST_PASSWORD=yourpassword
TEST_BASE_URL=http://localhost:3000
```

---

## Running order

Run in this order — each layer builds on the previous:

```
Layer 1 → Layer 3 → Layer 2 → Layer 4 → Layer 5
  DB         Claude    API      Audio     E2E
```

Layer 3 before Layer 2 because if Claude parsing is broken, the API tests will fail and you won't know why.

Layer 4 on real phones before Layer 5, so you know the recorder works before testing the full app.
