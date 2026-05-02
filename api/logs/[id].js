/**
 * PATCH /api/logs/[id]?type=maintenance|fuel
 *
 * Updates a single log entry. Used when the user taps "Edit"
 * on a log that was auto-saved (or flagged for review).
 *
 * Body (JSON): partial fields to update
 *
 * Response:
 *   { updated: LogEntry }
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

// Fields allowed to be updated per log type
const MAINTENANCE_EDITABLE = [
  'category', 'description', 'parts_replaced', 'mileage',
  'shop_name', 'location', 'cost', 'labor_cost', 'parts_cost',
  'next_service_mileage', 'next_service_date', 'notes', 'logged_at',
];

const FUEL_EDITABLE = [
  'gallons', 'price_per_gallon', 'total_cost', 'fuel_grade',
  'full_tank', 'mileage', 'miles_since_last', 'station_name',
  'location', 'notes', 'logged_at',
];

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const { id, type: queryType } = req.query;
  const { type: bodyType, ...updates } = req.body || {};
  const type = queryType || bodyType;

  if (!id || !type) {
    return res.status(400).json({ error: 'id and type are required' });
  }

  const supabase = getSupabase(authHeader);
  const table = type === 'fuel' ? 'fuel_logs' : 'maintenance_logs';

  if (req.method === 'DELETE') {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ deleted: id });
  }

  const allowedFields = type === 'fuel' ? FUEL_EDITABLE : MAINTENANCE_EDITABLE;

  // Strip any fields that aren't in the allowlist
  const sanitized = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedFields.includes(key))
  );

  if (Object.keys(sanitized).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { data, error } = await supabase
    .from(table)
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // If mileage was updated, bump vehicle's current_mileage
  if (sanitized.mileage) {
    // Get vehicle_id from the record
    const vehicleId = data.vehicle_id;
    await supabase.rpc('update_vehicle_mileage_if_higher', {
      p_vehicle_id: vehicleId,
      p_mileage: sanitized.mileage,
    });
  }

  return res.status(200).json({ updated: { ...data, logType: type } });
}
