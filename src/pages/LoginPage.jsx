import { useState } from 'react';
import { supabase } from '../supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('password'); // 'password' | 'magic' | 'forgot'
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

  async function handleForgotPassword(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
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

  const btnStyle = (disabled) => ({
    width: '100%',
    padding: '14px',
    background: disabled ? '#333' : '#2563eb',
    color: '#fff',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background 0.15s',
  });

  function switchMode(m) {
    setMode(m);
    setError(null);
    setSent(false);
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

        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
          Vehicle Logger
        </h1>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>
          Sign in to access your logs
        </p>

        {/* Mode toggle — only show for password / magic, not forgot */}
        {mode !== 'forgot' && (
          <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: '10px', padding: '4px', marginBottom: '24px', border: '1px solid #333' }}>
            {[
              { id: 'password', label: 'Password' },
              { id: 'magic', label: 'Magic Link' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => switchMode(id)}
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
        )}

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
            {mode === 'forgot'
              ? `Password reset email sent to ${email}. Check your inbox and tap the link.`
              : `Magic link sent to ${email}. Check your inbox and tap the link.`
            }
            <div style={{ marginTop: '16px' }}>
              <button
                onClick={() => switchMode('password')}
                style={{ color: '#60a5fa', background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', padding: 0 }}
              >
                Back to sign in
              </button>
            </div>
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
            <button type="submit" disabled={loading || !email || !password} style={btnStyle(loading || !email || !password)}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                onClick={() => switchMode('forgot')}
                style={{ color: '#60a5fa', background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', padding: 0 }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        ) : mode === 'magic' ? (
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
            <button type="submit" disabled={loading || !email} style={btnStyle(loading || !email)}>
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        ) : (
          // Forgot password
          <form onSubmit={handleForgotPassword}>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
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
            <button type="submit" disabled={loading || !email} style={btnStyle(loading || !email)}>
              {loading ? 'Sending...' : 'Send reset email'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                onClick={() => switchMode('password')}
                style={{ color: '#60a5fa', background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', padding: 0 }}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
{/* DEV ONLY — remove before sharing with users */}
<button
  type="button"
  onClick={() => {
    window.location.hash = 'type=recovery';
    window.location.reload();
  }}
  style={{
    marginTop: '2rem',
    background: 'none',
    border: 'none',
    color: '#333',
    fontSize: '0.7rem',
    cursor: 'pointer',
    textAlign: 'center',
    width: '100%',
  }}
>
  [dev] test reset form
</button>
    </div>
  );
}
