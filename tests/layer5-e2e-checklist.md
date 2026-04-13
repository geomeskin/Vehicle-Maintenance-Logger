# Layer 5: End-to-End Test Checklist

Run this checklist after the frontend is deployed. Do it once on Android and once on iOS.

---

## Before you start

- [ ] Supabase migrations 001 and 002 both ran successfully
- [ ] All environment variables are set in Vercel
- [ ] App is deployed and loading at your URL
- [ ] You're signed into the app on both phones

---

## Test A — Android (your phone)

### A1. First load
- [ ] App loads without a white screen or console errors
- [ ] Both vehicles appear in the vehicle switcher
- [ ] Tapping a vehicle selects it (highlighted)

### A2. Record a maintenance log
1. Select your truck/first vehicle
2. Tap the record button
3. Say: **"Oil change at Jiffy Lube, 47,000 miles, cost me 89 bucks"**
4. Tap stop

- [ ] Recording timer counted up while speaking
- [ ] A "processing" indicator appeared after stopping
- [ ] A parsed card appeared showing:
  - Category: oil change
  - Mileage: ~47,000
  - Cost: ~$89.00
  - Shop: Jiffy Lube (or similar)
- [ ] No "needs review" warning banner (confidence was high)

### A3. Verify in Supabase
In Supabase → Table Editor → maintenance_logs:
- [ ] A new row exists with `category = 'oil_change'`
- [ ] `mileage` is ~47000
- [ ] `cost` is ~89
- [ ] `raw_log_id` is set (links back to raw transcript)

In Supabase → vehicles:
- [ ] `current_mileage` updated to 47000 (or kept higher if already higher)

### A4. Record a fuel log
Say: **"Filled up, 15 gallons, three eighty-nine a gallon, odometer at 47,312"**

- [ ] Parsed as fuel (not maintenance)
- [ ] Gallons: ~15
- [ ] Price per gallon: ~$3.89
- [ ] Mileage: ~47,312

### A5. Edit a log
- [ ] Tap on the oil change card
- [ ] Edit the cost field to $92.50
- [ ] Save
- [ ] Card updates to show $92.50
- [ ] Supabase row shows updated cost

### A6. Log history
- [ ] Both logs appear in the history feed
- [ ] Sorted newest first
- [ ] Each card shows the right icon (wrench for maintenance, fuel pump for fuel)

---

## Test B — iOS (wife's phone)

### B1. First load
- [ ] App loads in Safari
- [ ] Install to Home Screen prompt visible (or you know how to trigger it manually)
- [ ] Both vehicles appear

### B2. Microphone permission
- [ ] First tap on record shows iOS mic permission dialog
- [ ] After allowing, recording starts
- [ ] No browser errors about microphone

### B3. Record and parse (same test as A2)
Say: **"Took the car in for a tire rotation, 38,500 miles, cost 25 dollars"**

- [ ] Recording works (mp4/m4a format on iOS)
- [ ] Parsed card shows: category=tires, mileage=~38500, cost=~25
- [ ] Record shows up in Supabase under the correct vehicle

### B4. Cross-platform sync
- [ ] Log recorded on iOS appears in Android app after refresh
- [ ] Log recorded on Android appears in iOS app after refresh

---

## Test C — Error handling

### C1. Garbled/short recording
Say nothing, or just say **"um"** for 1 second, then stop.

- [ ] App doesn't crash
- [ ] Either shows "needs review" banner, or gracefully shows unknown type
- [ ] Raw transcript was still saved in Supabase (`raw_voice_logs` table)
- [ ] `parse_status` is either `'failed'` or `'corrected'`

### C2. No internet mid-recording
Turn on airplane mode, record and try to save.

- [ ] App shows an error message (not a blank screen)
- [ ] Does not silently lose the recording

### C3. Long recording
Record for 30+ seconds of rambling.

- [ ] No timeout errors
- [ ] Transcript comes back (may be partial)
- [ ] App handles it gracefully

---

## Test D — Vehicle switching

- [ ] Switching vehicles clears the log feed and shows the correct logs
- [ ] Log recorded for Vehicle 1 does NOT appear when Vehicle 2 is selected
- [ ] Mileage shown in vehicle card matches `current_mileage` in Supabase

---

## Pass criteria

| Grade | Criteria |
|---|---|
| ✅ Ship it | A1–A6 pass, B1–B4 pass, C1 pass |
| ⚠️ Minor issues | 1–2 non-critical items fail (e.g. edit flow buggy) |
| ❌ Not ready | Any of A2, A4, B2, B3 fail |

---

## Useful Supabase debug queries

Run these in the SQL Editor to inspect what's happening:

```sql
-- Last 10 raw voice logs with parse status
select id, transcript, parse_status, log_type, error_message, created_at
from raw_voice_logs
order by created_at desc
limit 10;

-- Last 10 maintenance logs
select v.name, m.category, m.description, m.mileage, m.cost, m.logged_at
from maintenance_logs m
join vehicles v on v.id = m.vehicle_id
order by m.logged_at desc
limit 10;

-- Last 10 fuel logs with MPG
select vehicle_name, mileage, gallons, miles_since_last, mpg, logged_at
from fuel_economy
order by logged_at desc
limit 10;

-- Any failed parses
select transcript, error_message, created_at
from raw_voice_logs
where parse_status = 'failed'
order by created_at desc;
```
