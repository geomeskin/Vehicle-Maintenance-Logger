import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function ResetPasswordPage({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Grab email immediately on mount while session is still valid
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => onDone(), 2000);
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
          Set new password
        </h1>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>
          Choose a password you'll use to sign in.
        </p>

        {success ? (
          <div style={{
            background: '##1a2e1a',
            border: '1px solid #2a4a2a',
            borderRadius: '12px',
            padding: '20px',
            color: '#4ade80',
            fontSize: '14px',
            lineHeight: '1.6',
          }}>
            Password updated! Signing you in...
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={inputStyle}
            />
            {error && (
              <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              style={{
                width: '100%',
                padding: '14px',
                background: loading || !password || !confirm ? '#333' : '#2563eb',
                color: '#fff',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                cursor: loading || !password || !confirm ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Saving...' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}