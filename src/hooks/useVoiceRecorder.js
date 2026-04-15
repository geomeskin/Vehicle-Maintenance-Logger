
import { useState, useRef, useCallback } from 'react';

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useVoiceRecorder(onBlobReady) {
  const [state, setState] = useState('idle');
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
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setDuration(0);

    try {
      // Call getUserMedia FIRST before any setState — iOS requires direct user gesture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });

      setState('requesting');
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        cleanup();
        setState('idle');
        if (onBlobReady) onBlobReady(blob);
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
      if (err.name === 'NotAllowedError') message = 'Microphone permission denied. Please allow microphone access.';
      else if (err.name === 'NotFoundError') message = 'No microphone found on this device.';
      setError(message);
      setState('error');
      cleanup();
    }
  }, [cleanup, onBlobReady]);

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