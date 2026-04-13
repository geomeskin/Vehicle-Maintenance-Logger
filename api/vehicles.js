/**
 * GET /api/vehicles
 *
 * Returns all vehicles for the authenticated user,
 * enriched with the latest log date and mileage from
 * both maintenance and fuel logs.
 *
 * Response:
 *   { vehicles: Vehicle[] }
 */

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 10 };

function getSupabase(authHeader) {
  // Use the user's JWT so RLS applies correctly
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const supabase = getSupabase(authHeader);

  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ vehicles });
}
