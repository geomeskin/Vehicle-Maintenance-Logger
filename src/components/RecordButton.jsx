import { useEffect, useRef } from 'react';

const STATES = {
  idle:       { label: 'HOLD TO RECORD', color: 'var(--bg3)', border: 'var(--border2)', text: 'var(--text2)' },
  requesting: { label: 'REQUESTING MIC', color: 'var(--bg3)', border: 'var(--border2)', text: 'var(--text2)' },
  recording:  { label: 'RECORDING',      color: '#1a0a0a',    border: 'var(--red)',      text: 'var(--red)' },
  processing: { label: 'TRANSCRIBING',   color: '#0a0f1a',    border: 'var(--blue)',     text: 'var(--blue)' },
  parsing:    { label: 'PARSING',        color: '#0a0f1a',    border: 'var(--accent)',   text: 'var(--accent)' },
  done:       { label: 'SAVED',          color: '#0a1a0a',    border: 'var(--green)',    text: 'var(--green)' },
  error:      { label: 'ERROR',          color: '#1a0a0a',    border: 'var(--red)',      text: 'var(--red)' },
};

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecordButton({ recorderState, duration, onStart, onStop, disabled }) {
  const isRecording = recorderState === 'recording';
  const style = STATES[recorderState] || STATES.idle;
  const pulseRef = useRef(null);

  useEffect(() => {
    if (isRecording && pulseRef.current) {
      pulseRef.current.style.animation = 'pulse-ring 1.2s ease-out infinite';
    } else if (pulseRef.current) {
      pulseRef.current.style.animation = 'none';
    }
  }, [isRecording]);

  function handleClick() {
    if (disabled) return;
    if (recorderState === 'idle' || recorderState === 'done' || recorderState === 'error') {
      onStart();
    } else if (recorderState === 'recording') {
      onStop();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 0.6; }
          70%  { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Pulse ring */}
      <div style={{ position: 'relative', width: '200px', height: '200px' }}>
        <div
          ref={pulseRef}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid var(--red)`,
            pointerEvents: 'none',
          }}
        />

        {/* Main button */}
        <button
          onClick={handleClick}
          disabled={disabled || recorderState === 'requesting' || recorderState === 'processing' || recorderState === 'parsing'}
          style={{
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: style.color,
            border: `2px solid ${style.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          {/* Icon */}
          {recorderState === 'processing' || recorderState === 'parsing' ? (
            <div style={{
              width: '28px', height: '28px',
              border: `2px solid ${style.text}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          ) : recorderState === 'recording' ? (
            <div style={{
              width: '28px', height: '28px',
              background: 'var(--red)',
              borderRadius: '4px',
            }} />
          ) : recorderState === 'done' ? (
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16L13 23L26 9" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="11" y="4" width="10" height="18" rx="5" stroke={style.text} strokeWidth="2"/>
              <path d="M6 16c0 5.523 4.477 10 10 10s10-4.477 10-10" stroke={style.text} strokeWidth="2" strokeLinecap="round"/>
              <line x1="16" y1="26" x2="16" y2="30" stroke={style.text} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}

          {/* Label */}
          <span style={{
            fontSize: '11px',
            letterSpacing: '0.1em',
            color: style.text,
            fontFamily: 'var(--font-mono)',
          }}>
            {style.label}
          </span>
        </button>
      </div>

      {/* Timer */}
      <div style={{
        fontSize: '32px',
        fontFamily: 'var(--font-display)',
        fontWeight: '800',
        color: isRecording ? 'var(--red)' : 'var(--text3)',
        letterSpacing: '-0.02em',
        minHeight: '40px',
        transition: 'color 0.3s',
      }}>
        {isRecording ? formatDuration(duration) : ''}
      </div>
    </div>
  );
}
