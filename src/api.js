/**
 * api.js — Frontend API client
 *
 * Wraps all calls to /api/* routes with the Supabase auth token.
 * Import these functions in React components instead of calling fetch directly.
 */

import { supabase } from './supabase';

// ── Auth header helper ─────────────────────────────────────────────────────
async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

// ── Transcribe audio blob → transcript string ─────────────────────────────
/**
 * @param {Blob} audioBlob
 * @returns {Promise<string>} transcript
 */
export async function transcribeAudio(audioBlob) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Determine filename extension from MIME type
  const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
  const filename = `recording.${ext}`;

  const form = new FormData();
  form.append('audio', audioBlob, filename);

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      // Do NOT set Content-Type with FormData — browser sets it with boundary
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Transcription failed' }));
    throw new Error(err.error || 'Transcription failed');
  }

  const { transcript } = await res.json();
  return transcript;
}

// ── Parse transcript → structured log (saves to DB) ──────────────────────
/**
 * @param {object} params
 * @param {string} params.transcript
 * @param {string} params.vehicleId
 * @param {string} params.vehicleName
 * @param {number} params.currentMileage
 * @returns {Promise<ParseResult>}
 */
export async function parseLog({ transcript, vehicleId, vehicleName, currentMileage }) {
  const headers = await authHeaders();

  const res = await fetch('/api/parse-log', {
    method: 'POST',
    headers,
    body: JSON.stringify({ transcript, vehicleId, vehicleName, currentMileage }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Parse failed' }));
    throw new Error(err.error || 'Parse failed');
  }

  return res.json();
}

// ── Fetch all vehicles ────────────────────────────────────────────────────
export async function fetchVehicles() {
  const headers = await authHeaders();
  const res = await fetch('/api/vehicles', { headers });
  if (!res.ok) throw new Error('Failed to fetch vehicles');
  const { vehicles } = await res.json();
  return vehicles;
}

// ── Fetch logs for a vehicle ──────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string} params.vehicleId
 * @param {'all'|'maintenance'|'fuel'} [params.type]
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 */
export async function fetchLogs({ vehicleId, type = 'all', limit = 20, offset = 0 }) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ vehicleId, type, limit, offset });
  const res = await fetch(`/api/logs?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

// ── Update a log entry ────────────────────────────────────────────────────
/**
 * @param {string} id — log UUID
 * @param {'maintenance'|'fuel'} type
 * @param {object} updates — fields to update
 */
export async function updateLog(id, type, updates) {
  const headers = await authHeaders();
  const res = await fetch(`/api/logs/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ type, ...updates }),
  });
  if (!res.ok) throw new Error('Failed to update log');
  return res.json();
}
