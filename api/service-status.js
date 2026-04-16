/**
 * GET /api/service-status?vehicleId=<uuid>
 *
 * Returns service status for all configured intervals on a vehicle.
 * Compares last service mileage from maintenance_logs against
 * the vehicle's current_mileage and configured service_intervals.
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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const { vehicleId } = req.query;
  if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

  const supabase = getSupabase(authHeader);

  // Fetch vehicle current mileage
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('id, current_mileage')
    .eq('id', vehicleId)
    .single();

  if (vehicleError || !vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  // Fetch all service intervals for this vehicle
  const { data: intervals, error: intervalsError } = await supabase
    .from('service_intervals')
    .select('*')
    .eq('vehicle_id', vehicleId);

  if (intervalsError) return res.status(500).json({ error: intervalsError.message });
  if (!intervals.length) return res.status(200).json({ status: [] });

  // For each interval, find the last matching maintenance log
  const statusItems = await Promise.all(intervals.map(async (interval) => {
    const { data: lastLog } = await supabase
      .from('maintenance_logs')
      .select('mileage, logged_at')
      .eq('vehicle_id', vehicleId)
      .eq('category', interval.service_type)
      .not('mileage', 'is', null)
      .order('logged_at', { ascending: false })
      .limit(1)
      .single();

    const currentMileage = vehicle.current_mileage || 0;
    const lastMileage = lastLog?.mileage || null;
    const milesSinceLast = lastMileage !== null ? currentMileage - lastMileage : null;
    const warningAt = interval.warning_threshold_miles || Math.round(interval.interval_miles * 0.8);

    let status = 'ok';
    if (milesSinceLast === null) {
      status = 'unknown'; // no log on record
    } else if (milesSinceLast >= interval.interval_miles) {
      status = 'overdue';
    } else if (milesSinceLast >= warningAt) {
      status = 'due_soon';
    }

    return {
      service_type: interval.service_type,
      interval_miles: interval.interval_miles,
      warning_threshold_miles: warningAt,
      last_mileage: lastMileage,
      last_logged_at: lastLog?.logged_at || null,
      current_mileage: currentMileage,
      miles_since_last: milesSinceLast,
      miles_remaining: lastMileage !== null ? interval.interval_miles - milesSinceLast : null,
      status,
    };
  }));

  return res.status(200).json({ status: statusItems });
}