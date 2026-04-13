/**
 * GET /api/logs?vehicleId=<uuid>&type=all|maintenance|fuel&limit=20&offset=0
 *
 * Returns paginated log history for a vehicle,
 * merging maintenance and fuel logs into a single sorted feed.
 *
 * Response:
 *   {
 *     logs: LogEntry[],
 *     total: number,
 *     hasMore: boolean
 *   }
 */

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 10 };

function getSupabase(authHeader) {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } } }
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const {
    vehicleId,
    type = 'all',
    limit = '20',
    offset = '0',
  } = req.query;

  if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

  const supabase = getSupabase(authHeader);
  const pageSize = Math.min(parseInt(limit), 100);
  const pageOffset = parseInt(offset);

  const logs = [];

  // ── Fetch maintenance logs ─────────────────────────────────────────────
  if (type === 'all' || type === 'maintenance') {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select(`
        id, category, description, mileage, cost, shop_name,
        location, parts_replaced, notes, logged_at, created_at,
        next_service_mileage, next_service_date,
        labor_cost, parts_cost
      `)
      .eq('vehicle_id', vehicleId)
      .order('logged_at', { ascending: false })
      .range(pageOffset, pageOffset + pageSize - 1);

    if (error) return res.status(500).json({ error: error.message });

    data.forEach((row) =>
      logs.push({ ...row, logType: 'maintenance' })
    );
  }

  // ── Fetch fuel logs ────────────────────────────────────────────────────
  if (type === 'all' || type === 'fuel') {
    const { data, error } = await supabase
      .from('fuel_logs')
      .select(`
        id, gallons, price_per_gallon, total_cost, fuel_grade,
        full_tank, mileage, miles_since_last, station_name,
        location, notes, logged_at, created_at
      `)
      .eq('vehicle_id', vehicleId)
      .order('logged_at', { ascending: false })
      .range(pageOffset, pageOffset + pageSize - 1);

    if (error) return res.status(500).json({ error: error.message });

    data.forEach((row) =>
      logs.push({ ...row, logType: 'fuel' })
    );
  }

  // ── Sort merged results by logged_at desc ──────────────────────────────
  logs.sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));

  // ── Trim to requested page size ────────────────────────────────────────
  const paginated = logs.slice(0, pageSize);

  return res.status(200).json({
    logs: paginated,
    hasMore: logs.length > pageSize,
    count: paginated.length,
  });
}
