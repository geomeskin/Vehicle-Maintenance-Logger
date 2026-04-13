/**
 * POST /api/transcribe
 *
 * Accepts a multipart/form-data audio file, sends it to OpenAI Whisper,
 * and returns the transcript text.
 *
 * Body (multipart/form-data):
 *   audio: Blob  — the recorded audio file (.webm on Android, .mp4 on iOS)
 *
 * Response:
 *   { transcript: string }
 *
 * Vercel config: maxDuration 30s, bodyParser disabled (we handle multipart manually)
 */

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  try {
    // Read the raw request body as a Buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Forward the raw multipart body directly to OpenAI Whisper
    // Whisper accepts: mp4, m4a, webm, mp3, wav, ogg, flac (up to 25MB)
    const contentType = req.headers['content-type'];

    const formData = new FormData();

    // Extract the audio blob from the raw body using the content-type boundary
    // We pass through the raw body as-is to avoid any re-encoding issues
    const audioBlob = new Blob([rawBody], { type: contentType });

    // Build a fresh FormData to send to OpenAI
    // We need to parse the multipart ourselves to extract just the audio field
    const openAIForm = await extractAndRebuildForm(rawBody, contentType);

    const whisperResponse = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          // Do NOT set Content-Type — fetch sets it with the correct boundary
        },
        body: openAIForm,
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      return res.status(whisperResponse.status).json({
        error: 'Whisper transcription failed',
        detail: errorText,
      });
    }

    const { text: transcript } = await whisperResponse.json();

    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}

/**
 * Parses a multipart/form-data body to extract the "audio" field,
 * then rebuilds a clean FormData for the Whisper API.
 *
 * This avoids pulling in a heavy multipart parsing library.
 */
async function extractAndRebuildForm(rawBody, contentType) {
  // Extract boundary from Content-Type header
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) {
    throw new Error('No boundary found in Content-Type');
  }
  const boundary = boundaryMatch[1];

  // Split body on boundary
  const bodyStr = rawBody.toString('binary');
  const delimiter = `--${boundary}`;
  const parts = bodyStr.split(delimiter).filter(
    (p) => p !== '' && p !== '--\r\n' && p !== '--'
  );

  let audioBuffer = null;
  let audioFilename = 'audio.webm';
  let audioMimeType = 'audio/webm';

  for (const part of parts) {
    // Each part: \r\nHeaders\r\n\r\nBody\r\n
    const splitIndex = part.indexOf('\r\n\r\n');
    if (splitIndex === -1) continue;

    const headerSection = part.substring(0, splitIndex);
    const bodySection = part.substring(splitIndex + 4);

    // Remove trailing \r\n
    const bodyContent = bodySection.replace(/\r\n$/, '');

    if (headerSection.includes('name="audio"')) {
      // Extract filename if present
      const filenameMatch = headerSection.match(/filename="([^"]+)"/);
      if (filenameMatch) audioFilename = filenameMatch[1];

      // Extract content-type if present
      const mimeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
      if (mimeMatch) audioMimeType = mimeMatch[1].trim();

      // Convert binary string back to Buffer
      audioBuffer = Buffer.from(bodyContent, 'binary');
    }
  }

  if (!audioBuffer) {
    throw new Error('No "audio" field found in multipart form data');
  }

  // Rebuild FormData for Whisper
  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: audioMimeType });
  form.append('file', blob, audioFilename);
  form.append('model', 'whisper-1');
  form.append('language', 'en'); // remove if you want auto-detect

  return form;
}
