/**
 * GET  /api/vehicles  — list all vehicles for the authenticated user
 * POST /api/vehicles  — create a new vehicle
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

  // ── GET — list vehicles ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ vehicles });
  }

  // ── POST — create vehicle ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, make, model, year, color, vin, license_plate, current_mileage, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Vehicle name is required' });
    }

    // Get the user's ID from the session so we can set owner_id
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        make: make?.trim() || null,
        model: model?.trim() || null,
        year: year ? parseInt(year) : null,
        color: color?.trim() || null,
        vin: vin?.trim() || null,
        license_plate: license_plate?.trim() || null,
        current_mileage: current_mileage ? parseInt(current_mileage) : 0,
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ vehicle });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
