/**
 * GET /api/stats?vehicleId=<uuid>
 *
 * Returns all dashboard stats for a vehicle in a single query:
 * - Oil change status
 * - Total costs (this year + all time)
 * - MPG trend (last 10 fill-ups)
 * - Upcoming service reminders
 * - Cost breakdown by category
 * - Recent service history
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

  const { vehicleId } = req.query;
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

  const supabase = getSupabase(authHeader);

  // Run all queries in parallel
  // Limits added to prevent unbounded fetches as data grows
  const [
    vehicleRes,
    maintenanceRes,
    fuelRes,
    remindersRes,
  ] = await Promise.all([
    // Vehicle info
    supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .single(),

    // Maintenance logs — capped at 500, newest first
    // Enough for years of personal use; revisit if exceeded
    supabase
      .from('maintenance_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('logged_at', { ascending: false })
      .limit(500),

    // Fuel logs — capped at 500, newest first
    supabase
      .from('fuel_logs')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('logged_at', { ascending: false })
      .limit(500),

    // Upcoming reminders — only rows with next_service_mileage set
    supabase
      .from('maintenance_logs')
      .select('id, category, description, next_service_mileage, next_service_date, mileage, logged_at')
      .eq('vehicle_id', vehicleId)
      .not('next_service_mileage', 'is', null)
      .order('next_service_mileage', { ascending: true })
      .limit(20),
  ]);

  if (vehicleRes.error) return res.status(500).json({ error: vehicleRes.error.message });

  const vehicle = vehicleRes.data;
  const maintenance = maintenanceRes.data || [];
  const fuel = fuelRes.data || [];
  const reminders = remindersRes.data || [];

  // ── Oil change status ─────────────────────────────────────────────────────
  const oilChanges = maintenance.filter(m => m.category === 'oil_change');
  const lastOilChange = oilChanges[0] || null;
  const milesSinceOil = lastOilChange && vehicle.current_mileage
    ? vehicle.current_mileage - lastOilChange.mileage
    : null;
  const oilStatus = milesSinceOil === null ? 'unknown'
    : milesSinceOil > 4500 ? 'overdue'
    : milesSinceOil > 3500 ? 'due_soon'
    : 'ok';

  // ── Cost totals ───────────────────────────────────────────────────────────
  const thisYear = new Date().getFullYear();
  const maintenanceCosts = maintenance.filter(m => m.cost);
  const fuelCosts = fuel.filter(f => f.total_cost);

  const totalMaintenanceAllTime = maintenanceCosts.reduce((s, m) => s + Number(m.cost), 0);
  const totalFuelAllTime = fuelCosts.reduce((s, f) => s + Number(f.total_cost), 0);

  const totalMaintenanceThisYear = maintenanceCosts
    .filter(m => new Date(m.logged_at).getFullYear() === thisYear)
    .reduce((s, m) => s + Number(m.cost), 0);
  const totalFuelThisYear = fuelCosts
    .filter(f => new Date(f.logged_at).getFullYear() === thisYear)
    .reduce((s, f) => s + Number(f.total_cost), 0);

  // ── Cost by category ──────────────────────────────────────────────────────
  const categoryMap = {};
  maintenanceCosts.forEach(m => {
    if (!categoryMap[m.category]) categoryMap[m.category] = { count: 0, total: 0 };
    categoryMap[m.category].count++;
    categoryMap[m.category].total += Number(m.cost);
  });
  const costByCategory = Object.entries(categoryMap)
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);

  // ── MPG trend (last 10 fill-ups with miles_since_last) ────────────────────
  const mpgData = fuel
    .filter(f => f.gallons && f.miles_since_last && f.gallons > 0)
    .slice(0, 10)
    .map(f => ({
      date: f.logged_at,
      mileage: f.mileage,
      gallons: Number(f.gallons),
      miles_since_last: f.miles_since_last,
      mpg: Math.round((f.miles_since_last / f.gallons) * 10) / 10,
      total_cost: f.total_cost ? Number(f.total_cost) : null,
    }))
    .reverse(); // oldest first for charting

  const avgMpg = mpgData.length
    ? Math.round((mpgData.reduce((s, f) => s + f.mpg, 0) / mpgData.length) * 10) / 10
    : null;

  // ── Reminders with status ─────────────────────────────────────────────────
  const remindersWithStatus = reminders.map(r => {
    const milesUntil = r.next_service_mileage && vehicle.current_mileage
      ? r.next_service_mileage - vehicle.current_mileage
      : null;
    const status = milesUntil === null ? 'upcoming'
      : milesUntil < 0 ? 'overdue'
      : milesUntil < 500 ? 'due_very_soon'
      : milesUntil < 1500 ? 'due_soon'
      : 'upcoming';
    return { ...r, miles_until: milesUntil, status };
  });

  // ── Recent service history (last 30, combined) ────────────────────────────
  const history = [
    ...maintenance.slice(0, 20).map(m => ({ ...m, logType: 'maintenance' })),
    ...fuel.slice(0, 20).map(f => ({ ...f, logType: 'fuel' })),
  ]
    .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
    .slice(0, 30);

  return res.status(200).json({
    vehicle,
    oilChange: {
      lastOilChange,
      milesSinceOil,
      status: oilStatus,
    },
    costs: {
      maintenance: {
        allTime: Math.round(totalMaintenanceAllTime * 100) / 100,
        thisYear: Math.round(totalMaintenanceThisYear * 100) / 100,
      },
      fuel: {
        allTime: Math.round(totalFuelAllTime * 100) / 100,
        thisYear: Math.round(totalFuelThisYear * 100) / 100,
      },
      total: {
        allTime: Math.round((totalMaintenanceAllTime + totalFuelAllTime) * 100) / 100,
        thisYear: Math.round((totalMaintenanceThisYear + totalFuelThisYear) * 100) / 100,
      },
      byCategory: costByCategory,
    },
    mpg: {
      data: mpgData,
      average: avgMpg,
      fillUpsTracked: mpgData.length,
    },
    reminders: remindersWithStatus,
    history,
  });
}
