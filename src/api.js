import { supabase } from './supabase';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function transcribeAudio(audioBlob) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
  const form = new FormData();
  form.append('audio', audioBlob, `recording.${ext}`);
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Transcription failed' }));
    throw new Error(err.error || 'Transcription failed');
  }
  const { transcript } = await res.json();
  return transcript;
}

export async function parseLog({ transcript, vehicleId, vehicleName, currentMileage }) {
  const headers = await authHeaders();
  const res = await fetch('/api/parse-log', {
    method: 'POST', headers,
    body: JSON.stringify({ transcript, vehicleId, vehicleName, currentMileage }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Parse failed' }));
    throw new Error(err.error || 'Parse failed');
  }
  return res.json();
}

export async function fetchVehicles() {
  const headers = await authHeaders();
  const res = await fetch('/api/vehicles', { headers });
  if (!res.ok) throw new Error('Failed to fetch vehicles');
  const { vehicles } = await res.json();
  return vehicles;
}

export async function fetchLogs({ vehicleId, type = 'all', limit = 20, offset = 0 }) {
  const headers = await authHeaders();
  const params = new URLSearchParams({ vehicleId, type, limit, offset });
  const res = await fetch(`/api/logs?${params}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function updateLog(id, type, updates) {
  const headers = await authHeaders();
  const res = await fetch(`/api/logs/${id}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ type, ...updates }),
  });
  if (!res.ok) throw new Error('Failed to update log');
  return res.json();
}

export async function fetchStats(vehicleId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/stats?vehicleId=${vehicleId}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}
