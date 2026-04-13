import { supabase } from '../supabase';

export default function HomePage({ session }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: '#0f0f0f',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
        Vehicle Logger
      </h1>
      <p style={{ color: '#4ade80', fontSize: '14px', marginBottom: '4px' }}>
        Backend is live!
      </p>
      <p style={{ color: '#888', fontSize: '13px', marginBottom: '32px' }}>
        Signed in as {session?.user?.email}
      </p>
      <p style={{ color: '#555', fontSize: '13px', marginBottom: '32px' }}>
        Frontend coming soon...
      </p>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          padding: '10px 20px',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          color: '#888',
          fontSize: '13px',
        }}
      >
        Sign out
      </button>
    </div>
  );
}
