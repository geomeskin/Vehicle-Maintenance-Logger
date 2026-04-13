import { useState } from 'react';
import { supabase } from '../supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: '#0f0f0f',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
          Vehicle Logger
        </h1>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '32px' }}>
          Sign in to access your logs
        </p>

        {sent ? (
          <div style={{
            background: '#1a2e1a',
            border: '1px solid #2a4a2a',
            borderRadius: '12px',
            padding: '20px',
            color: '#4ade80',
            fontSize: '14px',
            lineHeight: '1.6',
          }}>
            Check your email — we sent a magic link to <strong>{email}</strong>.
            Tap it to sign in.
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '16px',
                marginBottom: '12px',
                outline: 'none',
              }}
            />
            {error && (
              <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#333' : '#2563eb',
                color: '#fff',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
