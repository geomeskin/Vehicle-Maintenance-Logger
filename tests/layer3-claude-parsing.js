#!/usr/bin/env node
/**
 * LAYER 3: Claude Parsing Tests
 *
 * Fires 15 realistic voice transcripts directly at the Claude API
 * and validates the structured JSON output — no database involved.
 *
 * This lets you tune the system prompt before real data is at stake.
 *
 * Setup:
 *   node tests/layer3-claude-parsing.js
 *
 * Requires: ANTHROPIC_API_KEY in .env.local
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const envFile = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
    envFile.split('\n').forEach(line => {
      const [key, ...vals] = line.split('=');
      if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
    });
  } catch {}
}
loadEnv();
console.log('KEY:', process.env.ANTHROPIC_API_KEY?.slice(0, 20));
// ── Same system prompt as parse-log.js ────────────────────────────────────
const SYSTEM_PROMPT = `You are a vehicle maintenance log parser. 
The user will give you a voice transcript of them logging vehicle maintenance or a fuel fill-up.
Your job is to extract structured data from the transcript and return ONLY valid JSON — no explanation, no markdown, no code fences.

Determine if this is:
- "maintenance" — oil changes, tire rotations, brake work, repairs, inspections, fluid top-offs, anything non-fuel
- "fuel" — a gas or diesel fill-up
- "unknown" — cannot determine

For MAINTENANCE logs, return:
{
  "logType": "maintenance",
  "confidence": 0.0-1.0,
  "category": "oil_change" | "tires" | "brakes" | "repair" | "fluid" | "inspection" | "other",
  "description": "concise description of what was done",
  "parts_replaced": ["part1", "part2"] or [],
  "mileage": number or null,
  "shop_name": "name of shop" or null,
  "location": "location description" or null,
  "cost": total cost as number or null,
  "labor_cost": number or null,
  "parts_cost": number or null,
  "next_service_mileage": number or null,
  "next_service_date": "YYYY-MM-DD" or null,
  "notes": "anything else mentioned" or null
}

For FUEL logs, return:
{
  "logType": "fuel",
  "confidence": 0.0-1.0,
  "gallons": number or null,
  "price_per_gallon": number or null,
  "total_cost": number or null,
  "fuel_grade": "regular" | "mid" | "premium" | "diesel" | null,
  "mileage": number or null,
  "miles_since_last": number or null,
  "station_name": "name of station" or null,
  "location": "location description" or null,
  "full_tank": true | false,
  "notes": "anything else mentioned" or null
}

For UNKNOWN logs, return:
{
  "logType": "unknown",
  "confidence": 0.0,
  "notes": "raw transcript as-is"
}

Rules:
- Extract mileage from phrases like "at 47 thousand", "47k miles", "odometer says 47,213"
- Extract costs from phrases like "cost me 89 bucks", "paid 45 dollars", "total was $120"
- If they say "full tank" or "filled it up", set full_tank: true
- If they mention a next oil change like "next change at 50k" or "in 3,000 miles", calculate next_service_mileage
- Be generous with partial info — fill what you can, null the rest
- confidence < 0.7 means you're guessing significantly; the app will flag it for review`;

// ── Test cases ─────────────────────────────────────────────────────────────
const TEST_CASES = [
  // ── MAINTENANCE ──────────────────────────────────────────────────────────
  {
    id: 'M01',
    label: 'Oil change — natural speech with mileage + cost',
    vehicleName: 'Blue Truck',
    transcript: 'Just got an oil change at Jiffy Lube on 45, 47 thousand miles, cost me 89 bucks',
    expect: { logType: 'maintenance', category: 'oil_change', mileageApprox: 47000, costApprox: 89 },
  },
  {
    id: 'M02',
    label: 'Oil change with next service reminder',
    vehicleName: 'Blue Truck',
    transcript: 'Did the oil change myself, at 52,300 miles, next one in 3000 miles, spent about 35 on the filter and oil',
    expect: { logType: 'maintenance', category: 'oil_change', next_service_mileage: 55300 },
  },
  {
    id: 'M03',
    label: 'Tire rotation + new tires',
    vehicleName: "Wife's Car",
    transcript: 'Got four new tires put on at Discount Tire, all season, they also rotated them, total was about 650, car has 38 thousand miles on it',
    expect: { logType: 'maintenance', category: 'tires', mileageApprox: 38000, costApprox: 650 },
  },
  {
    id: 'M04',
    label: 'Brake job with parts breakdown',
    vehicleName: 'Blue Truck',
    transcript: 'Replaced the front brake pads and rotors at Midas, parts were 120, labor was 180, so total 300 bucks, at 61k miles',
    expect: { logType: 'maintenance', category: 'brakes', costApprox: 300, labor_cost: 180, parts_cost: 120 },
  },
  {
    id: 'M05',
    label: 'Fluid top-off — casual speech',
    vehicleName: 'Blue Truck',
    transcript: 'topped off the coolant and windshield washer fluid, did it myself, no cost, at about 48500',
    expect: { logType: 'maintenance', category: 'fluid', mileageApprox: 48500 },
  },
  {
    id: 'M06',
    label: 'Battery replacement',
    vehicleName: "Wife's Car",
    transcript: "Car wouldn't start so I put in a new battery from AutoZone, 140 dollars, easy install, 41 thousand miles",
    expect: { logType: 'maintenance', category: 'repair', costApprox: 140 },
  },
  {
    id: 'M07',
    label: 'Annual inspection',
    vehicleName: 'Blue Truck',
    transcript: 'State inspection done, passed, at Valvoline, 75 bucks, truck is at 55200',
    expect: { logType: 'maintenance', category: 'inspection', mileageApprox: 55200, costApprox: 75 },
  },
  {
    id: 'M08',
    label: 'Transmission fluid change',
    vehicleName: 'Blue Truck',
    transcript: 'Had the transmission fluid flushed and replaced at the dealership, Ford dealer on the highway, 220 dollars, 60,000 miles',
    expect: { logType: 'maintenance', category: 'fluid', costApprox: 220 },
  },
  {
    id: 'M09',
    label: 'Minimal info — just the basics',
    vehicleName: 'Blue Truck',
    transcript: 'oil change done',
    expect: { logType: 'maintenance', category: 'oil_change' },
  },
  {
    id: 'M10',
    label: 'Wiper blades + cabin air filter',
    vehicleName: "Wife's Car",
    transcript: 'Changed the wipers and the cabin air filter myself, Amazon parts, maybe 30 bucks total, car at 39,400',
    expect: { logType: 'maintenance', category: 'other', costApprox: 30 },
  },

  // ── FUEL ─────────────────────────────────────────────────────────────────
  {
    id: 'F01',
    label: 'Fuel fill-up — full details',
    vehicleName: 'Blue Truck',
    transcript: 'Filled up the truck, 15 and a half gallons, paid three eighty nine a gallon, odometer at 52312',
    expect: { logType: 'fuel', gallonsApprox: 15.5, priceApprox: 3.89, mileageApprox: 52312 },
  },
  {
    id: 'F02',
    label: 'Fuel — total cost only',
    vehicleName: "Wife's Car",
    transcript: 'Gassed up the car, full tank, paid 58 dollars, at 41 thousand',
    expect: { logType: 'fuel', full_tank: true, costApprox: 58 },
  },
  {
    id: 'F03',
    label: 'Fuel — premium grade',
    vehicleName: "Wife's Car",
    transcript: 'Put in premium, only went to like 12 gallons, Shell station on 1960, four oh five a gallon',
    expect: { logType: 'fuel', fuel_grade: 'premium', gallonsApprox: 12 },
  },
  {
    id: 'F04',
    label: 'Fuel — diesel',
    vehicleName: 'Blue Truck',
    transcript: 'Diesel fill-up, 20 gallons, three sixty nine, Flying J off the interstate, 78 thousand miles',
    expect: { logType: 'fuel', fuel_grade: 'diesel', gallonsApprox: 20, mileageApprox: 78000 },
  },

  // ── EDGE CASES ────────────────────────────────────────────────────────────
  {
    id: 'E01',
    label: 'Ambiguous — should return unknown or low confidence',
    vehicleName: 'Blue Truck',
    transcript: 'uh yeah so I did the thing with the car',
    expect: { needsReview: true }, // logType unknown OR confidence < 0.7
  },
];

// ── Claude call ────────────────────────────────────────────────────────────
async function parseTranscript(vehicleName, transcript, currentMileage = 50000) {
  const userMessage = [
    `Vehicle: ${vehicleName}`,
    `Last known mileage: ${currentMileage.toLocaleString()}`,
    `Transcript: "${transcript}"`,
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

if (!res.ok) {
  const errText = await res.text();
  throw new Error(`Claude API error: ${res.status} — ${errText}`);
}

  const data = await res.json();
  const raw = data.content[0].text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(raw);
}

// ── Assertions ─────────────────────────────────────────────────────────────
function validateResult(parsed, expect, id) {
  const errors = [];

  if (expect.logType && parsed.logType !== expect.logType) {
    errors.push(`logType: expected "${expect.logType}", got "${parsed.logType}"`);
  }

  if (expect.category && parsed.category !== expect.category) {
    errors.push(`category: expected "${expect.category}", got "${parsed.category}"`);
  }

  if (expect.mileageApprox !== undefined) {
    const diff = Math.abs((parsed.mileage || 0) - expect.mileageApprox);
    if (diff > 1000) {
      errors.push(`mileage: expected ~${expect.mileageApprox}, got ${parsed.mileage} (diff: ${diff})`);
    }
  }

  if (expect.costApprox !== undefined) {
    const cost = parsed.cost || parsed.total_cost || 0;
    const diff = Math.abs(cost - expect.costApprox);
    if (diff > 20) {
      errors.push(`cost: expected ~${expect.costApprox}, got ${cost} (diff: ${diff})`);
    }
  }

  if (expect.gallonsApprox !== undefined) {
    const diff = Math.abs((parsed.gallons || 0) - expect.gallonsApprox);
    if (diff > 1) {
      errors.push(`gallons: expected ~${expect.gallonsApprox}, got ${parsed.gallons}`);
    }
  }

  if (expect.priceApprox !== undefined) {
    const diff = Math.abs((parsed.price_per_gallon || 0) - expect.priceApprox);
    if (diff > 0.1) {
      errors.push(`price_per_gallon: expected ~${expect.priceApprox}, got ${parsed.price_per_gallon}`);
    }
  }

  if (expect.fuel_grade !== undefined && parsed.fuel_grade !== expect.fuel_grade) {
    errors.push(`fuel_grade: expected "${expect.fuel_grade}", got "${parsed.fuel_grade}"`);
  }

  if (expect.full_tank !== undefined && parsed.full_tank !== expect.full_tank) {
    errors.push(`full_tank: expected ${expect.full_tank}, got ${parsed.full_tank}`);
  }

  if (expect.labor_cost !== undefined) {
    const diff = Math.abs((parsed.labor_cost || 0) - expect.labor_cost);
    if (diff > 10) errors.push(`labor_cost: expected ~${expect.labor_cost}, got ${parsed.labor_cost}`);
  }

  if (expect.parts_cost !== undefined) {
    const diff = Math.abs((parsed.parts_cost || 0) - expect.parts_cost);
    if (diff > 10) errors.push(`parts_cost: expected ~${expect.parts_cost}, got ${parsed.parts_cost}`);
  }

  if (expect.next_service_mileage !== undefined) {
    const diff = Math.abs((parsed.next_service_mileage || 0) - expect.next_service_mileage);
    if (diff > 500) {
      errors.push(`next_service_mileage: expected ~${expect.next_service_mileage}, got ${parsed.next_service_mileage}`);
    }
  }

  if (expect.needsReview) {
    const flagged = parsed.confidence < 0.7 || parsed.logType === 'unknown';
    if (!flagged) {
      errors.push(`expected needsReview (confidence < 0.7 or unknown), got confidence=${parsed.confidence} logType=${parsed.logType}`);
    }
  }

  return errors;
}

// ── Runner ─────────────────────────────────────────────────────────────────
async function runTests() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\n\x1b[31mANTHROPIC_API_KEY not set. Add it to .env.local\x1b[0m\n');
    process.exit(1);
  }

  console.log('\n\x1b[1m🧪 Layer 3: Claude Parsing Tests\x1b[0m');
  console.log(`   Model: claude-haiku-4-5`);
  console.log(`   Cases: ${TEST_CASES.length}\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const tc of TEST_CASES) {
    process.stdout.write(`  [${tc.id}] ${tc.label} ... `);

    try {
      const parsed = await parseTranscript(tc.vehicleName, tc.transcript);
      const errors = validateResult(parsed, tc.expect, tc.id);

      if (errors.length === 0) {
        console.log('\x1b[32m✓ PASS\x1b[0m');
        // Show key extracted values
        const vals = [];
        if (parsed.logType) vals.push(`type=${parsed.logType}`);
        if (parsed.category) vals.push(`cat=${parsed.category}`);
        if (parsed.mileage) vals.push(`mi=${parsed.mileage}`);
        if (parsed.cost || parsed.total_cost) vals.push(`$${parsed.cost || parsed.total_cost}`);
        if (parsed.gallons) vals.push(`${parsed.gallons}gal`);
        if (parsed.confidence !== undefined) vals.push(`conf=${parsed.confidence}`);
        if (vals.length) console.log(`        → ${vals.join(' | ')}`);
        passed++;
      } else {
        console.log('\x1b[31m✗ FAIL\x1b[0m');
        errors.forEach(e => console.log(`        → ${e}`));
        console.log(`        raw: ${JSON.stringify(parsed, null, 2).split('\n').join('\n        ')}`);
        failed++;
        failures.push({ id: tc.id, label: tc.label, errors });
      }
    } catch (err) {
      console.log(`\x1b[31m✗ ERROR\x1b[0m — ${err.message}`);
      failed++;
      failures.push({ id: tc.id, label: tc.label, errors: [err.message] });
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\x1b[1mResults: ${passed}/${TEST_CASES.length} passed\x1b[0m`);

  if (failures.length > 0) {
    console.log('\n\x1b[33mFailed cases — consider tuning the system prompt:\x1b[0m');
    failures.forEach(f => {
      console.log(`  [${f.id}] ${f.label}`);
      f.errors.forEach(e => console.log(`    • ${e}`));
    });

    console.log('\n\x1b[33mTip:\x1b[0m If parsing is consistently wrong for a category,');
    console.log('     add an example to the SYSTEM_PROMPT in api/parse-log.js\n');
  } else {
    console.log('\n\x1b[32mAll parsing tests passed! ✓\x1b[0m');
    console.log('The Claude prompt is well-tuned for your speech patterns.\n');
  }
}

runTests().catch(err => {
  console.error('\n\x1b[31mTest runner crashed:\x1b[0m', err.message);
  process.exit(1);
});
