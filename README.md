# Backend API Reference

All routes are Vercel serverless functions deployed under `/api/`.

## Environment Variables

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Where to find it |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key ⚠️ never expose client-side |

---

## Endpoints

### `POST /api/transcribe`
Sends audio to OpenAI Whisper and returns a text transcript.

**Request:** `multipart/form-data`
- `audio` — audio Blob (.webm, .mp4, .m4a)

**Response:**
```json
{ "transcript": "just did an oil change at Jiffy Lube, 47 thousand miles, cost me 89 bucks" }
```

---

### `POST /api/parse-log`
Sends a transcript to Claude (Haiku), extracts structured data, saves to Supabase.

**Request:** `application/json`
```json
{
  "transcript": "just did an oil change...",
  "vehicleId": "uuid",
  "vehicleName": "Blue Truck",
  "currentMileage": 46800
}
```

**Response:**
```json
{
  "rawLogId": "uuid",
  "logType": "maintenance",
  "parsed": { ...saved record from Supabase },
  "needsReview": false
}
```

**`needsReview: true`** when:
- Claude confidence score < 0.7
- Log type came back as `unknown`
- Parse failed entirely (transcript still saved)

**Rate limit — 429 response:**
```json
{
  "error": "Max logs per day exceeded",
  "detail": "This vehicle has reached the 10 log/day limit. Try again tomorrow.",
  "limit": 10,
  "current": 11
}
```
Max **10 logs per vehicle per calendar day**, enforced before any DB write or API call (no cost incurred on a blocked request). Resets at UTC midnight. The check fails open — if the count query itself errors, the request is allowed through. To adjust the limit, change `DAILY_LOG_LIMIT` in `api/parse-log.js`.

---

### `GET /api/vehicles`
Returns all vehicles. Requires `Authorization: Bearer <token>` header.

**Response:**
```json
{ "vehicles": [{ "id": "uuid", "name": "Blue Truck", "current_mileage": 47000, ... }] }
```

---

### `GET /api/logs`
Returns paginated log history for a vehicle.

**Query params:**
- `vehicleId` (required)
- `type` — `all` | `maintenance` | `fuel` (default: `all`)
- `limit` — max 100 (default: 20)
- `offset` — for pagination (default: 0)

**Response:**
```json
{
  "logs": [{ "logType": "maintenance", "category": "oil_change", ... }],
  "hasMore": true,
  "count": 20
}
```

---

### `PATCH /api/logs/[id]`
Updates a single log entry.

**Request:** `application/json`
```json
{
  "type": "maintenance",
  "cost": 95.00,
  "mileage": 47213
}
```

---

## Voice → DB Flow

```
User taps record
  → useVoiceRecorder hook captures audio (WebM on Android, MP4 on iOS)
  → POST /api/transcribe  →  Whisper STT  →  transcript text
  → POST /api/parse-log
      → rate limit check (10 logs/vehicle/day) → 429 if exceeded
      → raw_voice_logs INSERT (transcript saved immediately)
      → Claude Haiku parses transcript → structured JSON
      → maintenance_logs OR fuel_logs INSERT
      → update_vehicle_mileage_if_higher() RPC
      → raw_voice_log updated with parse result
  → Frontend shows parsed card
  → needsReview=true → show review banner
```

## Error handling strategy

- Rate limit exceeded → 429 returned before any API call or DB write, show "try again tomorrow" message
- Whisper fails → show error, let user re-record
- Claude parse fails → transcript saved in `raw_voice_logs` with `parse_status='failed'`, user can manually enter
- Supabase insert fails → returns error with `rawLogId` so transcript isn't lost

## Cold start note

Vercel serverless functions on the free plan have cold starts (~1-2s).
The transcription route uses Whisper (external API) so cold starts there are less noticeable.
The parse-log route should feel fast once warm.
