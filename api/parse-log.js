/**
 * POST /api/parse-log
 *
 * Takes a voice transcript + vehicle context, uses Claude to extract
 * structured data, then saves everything to Supabase (raw log + typed log).
 *
 * Body (JSON):
 *   {
 *     transcript: string,       — raw text from Whisper
 *     vehicleId: string,        — UUID of selected vehicle
 *     vehicleName: string,      — e.g. "Blue Truck" (helps Claude with context)
 *     currentMileage: number    — last known odometer (helps Claude fill gaps)
 *   }
 *
 * Response:
 *   {
 *     rawLogId: string,
 *     logType: 'maintenance' | 'fuel' | 'unknown',
 *     parsed: object,           — the structured record as saved
 *     needsReview: boolean      — true if confidence was low
 *   }
 */

import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

// Supabase admin client — uses service role key (bypasses RLS for server writes)
function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ============================================================
// CLAUDE SYSTEM PROMPT
// ============================================================
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
  "full_tank": true | false,
  "mileage": number or null,
  "miles_since_last": number or null,
  "station_name": "name of station" or null,
  "location": "location description" or null,
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

// ============================================================
// HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, vehicleId, vehicleName, currentMileage } = req.body;

  if (!transcript || !vehicleId) {
    return res.status(400).json({ error: 'transcript and vehicleId are required' });
  }

  const supabase = getSupabase();

  // ── 1. Save raw transcript immediately (so we never lose it) ──────────────
  const { data: rawLog, error: rawError } = await supabase
    .from('raw_voice_logs')
    .insert({
      vehicle_id: vehicleId,
      transcript,
      parse_status: 'pending',
    })
    .select('id')
    .single();

  if (rawError) {
    console.error('Failed to save raw log:', rawError);
    return res.status(500).json({ error: 'Failed to save raw log' });
  }

  const rawLogId = rawLog.id;

  // ── 2. Call Claude to parse ────────────────────────────────────────────────
  let parsed;
  try {
    const userMessage = [
      `Vehicle: ${vehicleName}`,
      currentMileage ? `Last known mileage: ${currentMileage.toLocaleString()}` : '',
      `Transcript: "${transcript}"`,
    ]
      .filter(Boolean)
      .join('\n');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Fast + cheap for parsing
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      throw new Error(`Claude API error: ${claudeRes.status}`);
    }

    const claudeData = await claudeRes.json();
    const rawJson = claudeData.content[0].text.trim();

    // Strip any accidental markdown fences
    const cleanJson = rawJson.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    console.error('Claude parse error:', err);

    // Mark raw log as failed but don't crash — transcript is safely saved
    await supabase
      .from('raw_voice_logs')
      .update({ parse_status: 'failed', error_message: err.message })
      .eq('id', rawLogId);

    return res.status(200).json({
      rawLogId,
      logType: 'unknown',
      parsed: null,
      needsReview: true,
      error: 'Parse failed — transcript saved, manual entry needed',
    });
  }

  // ── 3. Save to the correct typed table ───────────────────────────────────
  const needsReview = parsed.confidence < 0.7 || parsed.logType === 'unknown';
  let savedRecord = null;

  if (parsed.logType === 'maintenance') {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .insert({
        vehicle_id: vehicleId,
        raw_log_id: rawLogId,
        category: parsed.category ?? 'other',
        description: parsed.description ?? transcript.slice(0, 200),
        parts_replaced: parsed.parts_replaced ?? [],
        mileage: parsed.mileage,
        shop_name: parsed.shop_name,
        location: parsed.location,
        cost: parsed.cost,
        labor_cost: parsed.labor_cost,
        parts_cost: parsed.parts_cost,
        next_service_mileage: parsed.next_service_mileage,
        next_service_date: parsed.next_service_date,
        notes: parsed.notes,
        logged_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save maintenance log:', error);
      // Still mark raw as failed so user knows to check
      await supabase
        .from('raw_voice_logs')
        .update({ parse_status: 'failed', error_message: error.message, parsed_json: parsed, log_type: parsed.logType })
        .eq('id', rawLogId);
      return res.status(500).json({ error: 'Failed to save maintenance log', rawLogId });
    }

    savedRecord = data;

    // Update vehicle's current_mileage if this reading is higher
    if (parsed.mileage) {
      await supabase.rpc('update_vehicle_mileage_if_higher', {
        p_vehicle_id: vehicleId,
        p_mileage: parsed.mileage,
      });
    }
  } else if (parsed.logType === 'fuel') {
    const { data, error } = await supabase
      .from('fuel_logs')
      .insert({
        vehicle_id: vehicleId,
        raw_log_id: rawLogId,
        gallons: parsed.gallons,
        price_per_gallon: parsed.price_per_gallon,
        total_cost: parsed.total_cost,
        fuel_grade: parsed.fuel_grade,
        full_tank: parsed.full_tank ?? true,
        mileage: parsed.mileage,
        miles_since_last: parsed.miles_since_last,
        station_name: parsed.station_name,
        location: parsed.location,
        notes: parsed.notes,
        logged_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save fuel log:', error);
      await supabase
        .from('raw_voice_logs')
        .update({ parse_status: 'failed', error_message: error.message, parsed_json: parsed, log_type: parsed.logType })
        .eq('id', rawLogId);
      return res.status(500).json({ error: 'Failed to save fuel log', rawLogId });
    }

    savedRecord = data;

    if (parsed.mileage) {
      await supabase.rpc('update_vehicle_mileage_if_higher', {
        p_vehicle_id: vehicleId,
        p_mileage: parsed.mileage,
      });
    }
  }

  // ── 4. Update raw log with parse result ──────────────────────────────────
  await supabase
    .from('raw_voice_logs')
    .update({
      parsed_json: parsed,
      parse_status: needsReview ? 'corrected' : 'success',
      log_type: parsed.logType,
    })
    .eq('id', rawLogId);

  return res.status(200).json({
    rawLogId,
    logType: parsed.logType,
    parsed: savedRecord,
    needsReview,
  });
}
