/**
 * useVoiceRecorder.js
 *
 * Custom React hook for voice recording.
 * Handles cross-platform differences between Android (WebM/Opus)
 * and iOS Safari (MP4/AAC).
 *
 * Usage:
 *   const { state, start, stop, cancel, audioBlob, error } = useVoiceRecorder();
 *
 * States: 'idle' | 'requesting' | 'recording' | 'processing' | 'done' | 'error'
 */

import { useState, useRef, useCallback } from 'react';

// Determine the best supported MIME type for this browser/platform
function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus', // Android Chrome, desktop Chrome
    'audio/webm',              // Fallback WebM
    'audio/mp4',               // iOS Safari, Safari desktop
    'audio/ogg;codecs=opus',   // Firefox
    'audio/ogg',               // Firefox fallback
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return ''; // Let browser use default
}

export function useVoiceRecorder() {
  const [state, setState] = useState('idle');
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setDuration(0);
    setState('requesting');

    try {
      // Must be called from a user gesture on iOS
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Whisper works well at 16kHz
        },
      });

      streamRef.current = stream;
      const mimeType = getSupportedMimeType();

      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
      });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        setAudioBlob(blob);
        setState('done');
        cleanup();
      };

      recorder.onerror = (e) => {
        setError('Recording error: ' + e.error?.message);
        setState('error');
        cleanup();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Collect chunks every 250ms

      startTimeRef.current = Date.now();
      setState('recording');

      // Duration timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      let message = 'Microphone access denied';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        message = 'No microphone found on this device.';
      }
      setError(message);
      setState('error');
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      setState('processing');
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [state]);

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    cleanup();
    setAudioBlob(null);
    setState('idle');
  }, [cleanup]);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setError(null);
    setDuration(0);
    setState('idle');
  }, []);

  return { state, audioBlob, error, duration, start, stop, cancel, reset };
}
