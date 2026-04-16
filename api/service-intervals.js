/**
 * GET  /api/service-intervals?vehicleId=<uuid>  — get all intervals for a vehicle
 * POST /api/service-intervals                    — create or update an interval
 * DELETE /api/service-intervals?vehicleId=<uuid>&serviceType=<type> — delete an interval
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
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase(authHeader);

  // ── GET — fetch intervals for a vehicle ─────────────────────────────────
  if (req.method === 'GET') {
    const { vehicleId } = req.query;
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

    const { data, error } = await supabase
      .from('service_intervals')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('service_type');

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ intervals: data });
  }

  // ── POST — upsert an interval ────────────────────────────────────────────
  if (req.method === 'POST') {
    const { vehicle_id, service_type, interval_miles, warning_threshold_miles } = req.body;

    if (!vehicle_id || !service_type || !interval_miles) {
      return res.status(400).json({ error: 'vehicle_id, service_type, and interval_miles are required' });
    }

    const { data, error } = await supabase
      .from('service_intervals')
      .upsert({
        vehicle_id,
        service_type,
        interval_miles: parseInt(interval_miles),
        warning_threshold_miles: warning_threshold_miles
          ? parseInt(warning_threshold_miles)
          : Math.round(parseInt(interval_miles) * 0.8), // default to 80%
      }, { onConflict: 'vehicle_id,service_type' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ interval: data });
  }

  // ── DELETE — remove an interval ──────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { vehicleId, serviceType } = req.query;
    if (!vehicleId || !serviceType) {
      return res.status(400).json({ error: 'vehicleId and serviceType are required' });
    }

    const { error } = await supabase
      .from('service_intervals')
      .delete()
      .eq('vehicle_id', vehicleId)
      .eq('service_type', serviceType);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
