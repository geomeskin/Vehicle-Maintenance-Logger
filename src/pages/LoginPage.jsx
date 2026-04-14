import { useState } from 'react';
import { supabase } from '../supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('password'); // 'password' | 'magic'
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handlePasswordLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleMagicLink(e) {
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

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '16px',
    marginBottom: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  };

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

        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
          Vehicle Logger
        </h1>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>
          Sign in to access your logs
        </p>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: '10px', padding: '4px', marginBottom: '24px', border: '1px solid #333' }}>
          {[
            { id: 'password', label: 'Password' },
            { id: 'magic', label: 'Magic Link' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setError(null); setSent(false); }}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: '500',
                background: mode === id ? '#2563eb' : 'transparent',
                color: mode === id ? '#fff' : '#888',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

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
            Check your email — we sent a magic link to <strong>{email}</strong>. Tap it to sign in.
          </div>
        ) : mode === 'password' ? (
          <form onSubmit={handlePasswordLogin}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
            {error && (
              <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: '100%',
                padding: '14px',
                background: loading || !email || !password ? '#333' : '#2563eb',
                color: '#fff',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                cursor: loading || !email || !password ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
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
                background: loading || !email ? '#333' : '#2563eb',
                color: '#fff',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                cursor: loading || !email ? 'default' : 'pointer',
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
