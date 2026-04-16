/**
 * POST /api/logs/quick
 *
 * Saves a maintenance log directly without going through voice/Claude.
 * Used by the "I just did this" quick log flow from the service status modal.
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const { vehicleId, category, description, mileage, cost, shopName, notes } = req.body;

  if (!vehicleId || !category || !description) {
    return res.status(400).json({ error: 'vehicleId, category, and description are required' });
  }

  const supabase = getSupabase(authHeader);

  const loggedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('maintenance_logs')
    .insert({
      vehicle_id: vehicleId,
      category,
      description,
      mileage: mileage ? parseInt(mileage) : null,
      cost: cost ? parseFloat(cost) : null,
      shop_name: shopName || null,
      notes: notes || null,
      logged_at: loggedAt,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Update vehicle mileage if higher
  if (mileage) {
    await supabase.rpc('update_vehicle_mileage_if_higher', {
      p_vehicle_id: vehicleId,
      p_mileage: parseInt(mileage),
    });
  }

  // Return full log object with logType so LogCard renders correctly
  return res.status(201).json({
    log: {
      ...data,
      logType: 'maintenance',
    }
  });
}
