/**
 * GET /api/logs?vehicleId=<uuid>&type=all|maintenance|fuel&limit=20&before=<iso-timestamp>
 *
 * Returns paginated log history for a vehicle,
 * merging maintenance and fuel logs into a single sorted feed.
 *
 * Pagination uses a cursor (before=) instead of numeric offset.
 * Pass the logged_at of the last item in the previous page to get the next page.
 *
 * Response:
 *   {
 *     logs: LogEntry[],
 *     hasMore: boolean,
 *     nextCursor: string | null   — pass as ?before= for next page
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
    before,             // ISO timestamp cursor — undefined on first page
  } = req.query;

  if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

  const supabase = getSupabase(authHeader);
  const pageSize = Math.min(parseInt(limit), 100);

  // Fetch one extra row so we can detect hasMore without a count query
  const fetchSize = pageSize + 1;

  const logs = [];

  // ── Fetch maintenance logs ──────────────────────────────────────────────
  if (type === 'all' || type === 'maintenance') {
    let query = supabase
      .from('maintenance_logs')
      .select(`
        id, category, description, mileage, cost, shop_name,
        location, parts_replaced, notes, logged_at, created_at,
        next_service_mileage, next_service_date,
        labor_cost, parts_cost
      `)
      .eq('vehicle_id', vehicleId)
      .order('logged_at', { ascending: false })
      .limit(fetchSize);

    if (before) query = query.lt('logged_at', before);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    data.forEach(row => logs.push({ ...row, logType: 'maintenance' }));
  }

  // ── Fetch fuel logs ─────────────────────────────────────────────────────
  if (type === 'all' || type === 'fuel') {
    let query = supabase
      .from('fuel_logs')
      .select(`
        id, gallons, price_per_gallon, total_cost, fuel_grade,
        full_tank, mileage, miles_since_last, station_name,
        location, notes, logged_at, created_at
      `)
      .eq('vehicle_id', vehicleId)
      .order('logged_at', { ascending: false })
      .limit(fetchSize);

    if (before) query = query.lt('logged_at', before);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    data.forEach(row => logs.push({ ...row, logType: 'fuel' }));
  }

  // ── Sort merged results by logged_at desc ───────────────────────────────
  logs.sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));

  // ── Paginate ────────────────────────────────────────────────────────────
  const hasMore = logs.length > pageSize;
  const paginated = logs.slice(0, pageSize);
  const nextCursor = hasMore ? paginated[paginated.length - 1].logged_at : null;

  return res.status(200).json({
    logs: paginated,
    hasMore,
    nextCursor,   // pass as ?before= on next request
    count: paginated.length,
  });
}
