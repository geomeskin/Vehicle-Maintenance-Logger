/**
 * useVoiceRecorder.js
 *
 * Custom React hook for voice recording.
 * Handles cross-platform differences between Android (WebM/Opus)
 * and iOS Safari (MP4/AAC).
 *
 * Usage:
 *   const { state, start, stop, cancel, duration, error } = useVoiceRecorder(onAudioReady);
 *
 * States: 'idle' | 'requesting' | 'recording' | 'processing' | 'done' | 'error'
 */

import { useState, useRef, useCallback } from 'react';

function getSupportedMimeType() {
  const types = [
    'audio/mp4',               // iOS Safari — check FIRST
    'audio/webm;codecs=opus',  // Android Chrome, desktop Chrome
    'audio/webm',              // Fallback WebM
    'audio/ogg;codecs=opus',   // Firefox
    'audio/ogg',               // Firefox fallback
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useVoiceRecorder(onAudioReady) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const onAudioReadyRef = useRef(onAudioReady);
  onAudioReadyRef.current = onAudioReady; // always latest

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
    try {
      // ⚠️ iOS Safari: getUserMedia() MUST be the very first thing called.
      // Any setState() before this consumes the user gesture token and the
      // mic permission prompt silently never appears.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          // ⚠️ No sampleRate — causes silent failures on some iOS versions
        },
      });

      // Safe to update state now
      setError(null);
      setDuration(0);
      setState('requesting');

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
          type: mimeType || 'audio/mp4',
        });
        setState('idle'); // let HomePage drive the processing state
        cleanup();
        if (onAudioReadyRef.current) onAudioReadyRef.current(blob);
      };

      recorder.onerror = (e) => {
        setError('Recording error: ' + (e.error?.message || 'unknown'));
        setState('error');
        cleanup();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);

      startTimeRef.current = Date.now();
      setState('recording');

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
    setState('idle');
  }, [cleanup]);

  const reset = useCallback(() => {
    setError(null);
    setDuration(0);
    setState('idle');
  }, []);

  return { state, error, duration, start, stop, cancel, reset };
}