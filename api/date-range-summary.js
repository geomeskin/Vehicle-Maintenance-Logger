/**
 * GET /api/date-range-summary?vehicleId=<uuid>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Fuel and maintenance totals for a vehicle over an arbitrary date range
 * (trip costs, a specific month, tax season, etc.) — unlike /api/stats,
 * which only reports fixed windows (this week/month/year/all-time).
 */

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 15 };

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

  const { vehicleId, startDate, endDate } = req.query;
  if (!vehicleId || !startDate || !endDate) {
    return res.status(400).json({ error: 'vehicleId, startDate, and endDate are required' });
  }

  const supabase = getSupabase(authHeader);

  // endDate is a calendar day — include the whole day, not just midnight.
  const rangeStart = new Date(`${startDate}T00:00:00.000Z`).toISOString();
  const rangeEnd = new Date(`${endDate}T23:59:59.999Z`).toISOString();

  const [fuelRes, maintenanceRes] = await Promise.all([
    supabase
      .from('fuel_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .gte('logged_at', rangeStart)
      .lte('logged_at', rangeEnd)
      .order('logged_at', { ascending: true }),

    supabase
      .from('maintenance_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .gte('logged_at', rangeStart)
      .lte('logged_at', rangeEnd)
      .order('logged_at', { ascending: true }),
  ]);

  if (fuelRes.error) return res.status(500).json({ error: fuelRes.error.message });
  if (maintenanceRes.error) return res.status(500).json({ error: maintenanceRes.error.message });

  const fuelEntries = fuelRes.data || [];
  const maintenanceEntries = maintenanceRes.data || [];

  // ── Fuel totals ──────────────────────────────────────────────────────────
  const totalGallons = fuelEntries.reduce((sum, f) => sum + (f.gallons || 0), 0);
  const totalFuelCost = fuelEntries.reduce((sum, f) => sum + (f.total_cost || 0), 0);
  const avgPricePerGallon = totalGallons > 0 ? totalFuelCost / totalGallons : null;

  // ── Maintenance totals + breakdown by category ──────────────────────────
  const totalMaintenanceCost = maintenanceEntries.reduce((sum, m) => sum + (m.cost || 0), 0);
  const byCategory = {};
  for (const m of maintenanceEntries) {
    const cat = m.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = { category: cat, count: 0, total: 0 };
    byCategory[cat].count += 1;
    byCategory[cat].total += m.cost || 0;
  }

  return res.status(200).json({
    range: { startDate, endDate },
    fuel: {
      fillUps: fuelEntries.length,
      totalGallons: Math.round(totalGallons * 100) / 100,
      totalCost: Math.round(totalFuelCost * 100) / 100,
      avgPricePerGallon: avgPricePerGallon !== null ? Math.round(avgPricePerGallon * 1000) / 1000 : null,
      entries: fuelEntries,
    },
    maintenance: {
      totalCost: Math.round(totalMaintenanceCost * 100) / 100,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      entries: maintenanceEntries,
    },
    total: Math.round((totalFuelCost + totalMaintenanceCost) * 100) / 100,
  });
}
