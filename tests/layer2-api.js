#!/usr/bin/env node
/**
 * LAYER 2: API Route Tests
 *
 * Tests all serverless API endpoints with real HTTP requests.
 *
 * Setup:
 *   1. Copy .env.test.example to .env.test and fill in your values
 *   2. Make sure your dev server is running: npm run vercel-dev
 *   3. Run: node tests/layer2-api.js
 *
 * Or test against production:
 *   BASE_URL=https://your-app.vercel.app node tests/layer2-api.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env ───────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const envFile = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
    envFile.split('\n').forEach(line => {
      const [key, ...vals] = line.split('=');
      if (key && !key.startsWith('#')) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    });
  } catch {
    // env already set via shell
  }
}
loadEnv();

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL; // your supabase auth email
const TEST_PASSWORD = process.env.TEST_PASSWORD;

// ── Test runner ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log('\x1b[32m✓ PASS\x1b[0m');
    passed++;
    results.push({ name, status: 'pass' });
  } catch (err) {
    console.log(`\x1b[31m✗ FAIL\x1b[0m`);
    console.log(`    → ${err.message}`);
    failed++;
    results.push({ name, status: 'fail', error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Auth helper ────────────────────────────────────────────────────────────
async function getAuthToken() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.local');
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Auth failed: ${err}`);
  }

  const { access_token } = await res.json();
  return access_token;
}

// ── Tests ──────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n\x1b[1m🧪 Layer 2: API Route Tests\x1b[0m');
  console.log(`   Base URL: ${BASE_URL}\n`);

  // ── Auth ─────────────────────────────────────────────────────────────────
  console.log('\x1b[1m[Auth]\x1b[0m');
  let token;

  await test('get auth token from Supabase', async () => {
    token = await getAuthToken();
    assert(token && token.length > 20, 'Token should be a non-empty JWT');
    console.log(`\n    token: ${token.slice(0, 30)}...`);
  });

  if (!token) {
    console.log('\n\x1b[31mAuth failed — cannot continue. Check TEST_EMAIL and TEST_PASSWORD.\x1b[0m\n');
    process.exit(1);
  }

  const authHeader = { Authorization: `Bearer ${token}` };

  // ── GET /api/vehicles ─────────────────────────────────────────────────────
  console.log('\n\x1b[1m[GET /api/vehicles]\x1b[0m');
  let vehicles;

  await test('returns 200 with vehicles array', async () => {
    const res = await fetch(`${BASE_URL}/api/vehicles`, { headers: authHeader });
    assertEqual(res.status, 200, 'status');
    const body = await res.json();
    assert(Array.isArray(body.vehicles), 'body.vehicles should be an array');
    vehicles = body.vehicles;
    console.log(`\n    found ${vehicles.length} vehicle(s)`);
  });

  await test('vehicles have required fields', async () => {
    assert(vehicles && vehicles.length > 0, 'Should have at least 1 vehicle');
    const v = vehicles[0];
    assert(v.id, 'vehicle.id required');
    assert(v.name, 'vehicle.name required');
    assert(typeof v.current_mileage === 'number', 'vehicle.current_mileage should be a number');
    console.log(`\n    first vehicle: "${v.name}" (${v.current_mileage} miles)`);
  });

  await test('rejects request without auth', async () => {
    const res = await fetch(`${BASE_URL}/api/vehicles`);
    assertEqual(res.status, 401, 'status without auth');
  });

  const testVehicle = vehicles?.[0];

  // ── GET /api/logs ─────────────────────────────────────────────────────────
  console.log('\n\x1b[1m[GET /api/logs]\x1b[0m');

  await test('returns 200 with logs array', async () => {
    const url = `${BASE_URL}/api/logs?vehicleId=${testVehicle.id}`;
    const res = await fetch(url, { headers: authHeader });
    assertEqual(res.status, 200, 'status');
    const body = await res.json();
    assert(Array.isArray(body.logs), 'body.logs should be an array');
    assert(typeof body.hasMore === 'boolean', 'body.hasMore should be boolean');
    console.log(`\n    found ${body.logs.length} log(s)`);
  });

  await test('respects type=maintenance filter', async () => {
    const url = `${BASE_URL}/api/logs?vehicleId=${testVehicle.id}&type=maintenance`;
    const res = await fetch(url, { headers: authHeader });
    const body = await res.json();
    const hasWrongType = body.logs.some(l => l.logType !== 'maintenance');
    assert(!hasWrongType, 'All logs should be maintenance type');
  });

  await test('respects type=fuel filter', async () => {
    const url = `${BASE_URL}/api/logs?vehicleId=${testVehicle.id}&type=fuel`;
    const res = await fetch(url, { headers: authHeader });
    const body = await res.json();
    const hasWrongType = body.logs.some(l => l.logType !== 'fuel');
    assert(!hasWrongType, 'All logs should be fuel type');
  });

  await test('rejects missing vehicleId', async () => {
    const res = await fetch(`${BASE_URL}/api/logs`, { headers: authHeader });
    assertEqual(res.status, 400, 'status without vehicleId');
  });

  // ── POST /api/parse-log ───────────────────────────────────────────────────
  console.log('\n\x1b[1m[POST /api/parse-log]\x1b[0m');
  let parsedLogId;

  await test('parses oil change transcript', async () => {
    const res = await fetch(`${BASE_URL}/api/parse-log`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: 'Just got an oil change at Jiffy Lube, 47 thousand miles, cost me 89 bucks',
        vehicleId: testVehicle.id,
        vehicleName: testVehicle.name,
        currentMileage: testVehicle.current_mileage,
      }),
    });
    assertEqual(res.status, 200, 'status');
    const body = await res.json();
    assert(body.rawLogId, 'should return rawLogId');
    assertEqual(body.logType, 'maintenance', 'logType');
    assert(body.parsed, 'should return parsed record');
    assertEqual(body.parsed.category, 'oil_change', 'category');
    assert(body.parsed.mileage >= 47000, 'mileage should be ~47000');
    assert(body.parsed.cost > 0, 'cost should be > 0');
    parsedLogId = body.parsed.id;
    console.log(`\n    category: ${body.parsed.category}, mileage: ${body.parsed.mileage}, cost: $${body.parsed.cost}`);
  });

  await test('parses fuel fill-up transcript', async () => {
    const res = await fetch(`${BASE_URL}/api/parse-log`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: 'Filled up the truck, 15 and a half gallons, paid three eighty nine a gallon, odometer at 52312',
        vehicleId: testVehicle.id,
        vehicleName: testVehicle.name,
        currentMileage: testVehicle.current_mileage,
      }),
    });
    const body = await res.json();
    assertEqual(body.logType, 'fuel', 'logType');
    assert(body.parsed.gallons > 15, 'gallons should be ~15.5');
    assert(body.parsed.mileage > 50000, 'mileage should be ~52312');
    console.log(`\n    gallons: ${body.parsed.gallons}, mileage: ${body.parsed.mileage}`);
  });

  await test('gracefully handles garbled transcript', async () => {
    const res = await fetch(`${BASE_URL}/api/parse-log`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: 'uh um yeah so I did the thing with the car you know',
        vehicleId: testVehicle.id,
        vehicleName: testVehicle.name,
        currentMileage: 0,
      }),
    });
    const body = await res.json();
    assert(body.rawLogId, 'should still save rawLogId even on unknown');
    assert(body.needsReview === true, 'should flag for review');
    console.log(`\n    logType: ${body.logType}, needsReview: ${body.needsReview}`);
  });

  await test('rejects missing transcript', async () => {
    const res = await fetch(`${BASE_URL}/api/parse-log`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: testVehicle.id }),
    });
    assertEqual(res.status, 400, 'status without transcript');
  });

  // ── PATCH /api/logs/[id] ──────────────────────────────────────────────────
  console.log('\n\x1b[1m[PATCH /api/logs/[id]]\x1b[0m');

  await test('updates a maintenance log field', async () => {
    if (!parsedLogId) throw new Error('No parsedLogId from earlier test — skipping');
    const res = await fetch(`${BASE_URL}/api/logs/${parsedLogId}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'maintenance', cost: 99.99, notes: 'test update' }),
    });
    assertEqual(res.status, 200, 'status');
    const body = await res.json();
    assertEqual(Number(body.updated.cost), 99.99, 'updated cost');
    assertEqual(body.updated.notes, 'test update', 'updated notes');
    console.log(`\n    updated cost: $${body.updated.cost}, notes: "${body.updated.notes}"`);
  });

  await test('rejects updates to non-whitelisted fields', async () => {
    if (!parsedLogId) throw new Error('No parsedLogId — skipping');
    const res = await fetch(`${BASE_URL}/api/logs/${parsedLogId}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'maintenance', vehicle_id: 'hacked-id' }),
    });
    // Should either 400 (no valid fields) or silently ignore vehicle_id
    const body = await res.json();
    if (res.status === 200) {
      assert(body.updated.vehicle_id === testVehicle.id, 'vehicle_id should not change');
    } else {
      assertEqual(res.status, 400, 'status');
    }
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log(`\x1b[1mResults: ${passed} passed, ${failed} failed\x1b[0m`);

  if (failed > 0) {
    console.log('\n\x1b[31mFailed tests:\x1b[0m');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.error}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('\n\x1b[32mAll API tests passed! ✓\x1b[0m\n');
  }
}

runTests().catch(err => {
  console.error('\n\x1b[31mTest runner crashed:\x1b[0m', err.message);
  process.exit(1);
});
