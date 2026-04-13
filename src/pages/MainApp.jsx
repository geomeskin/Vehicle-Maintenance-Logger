import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { fetchVehicles } from '../api';
import HomePage from './HomePage.jsx';
import StatsPage from './StatsPage.jsx';

function LogIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5} strokeLinecap="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}

function StatsIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5} strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

export default function MainApp({ session }) {
  const [tab, setTab] = useState('log');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    fetchVehicles()
      .then(vs => {
        setVehicles(vs);
        if (vs.length > 0) setSelectedVehicle(vs[0]);
      })
      .catch(console.error);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '18px', color: 'var(--accent)', letterSpacing: '-0.01em' }}>
          VML
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
          {session?.user?.email?.split('@')[0]}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.05em', padding: '4px 8px' }}
        >
          SIGN OUT
        </button>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: tab === 'log' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <HomePage
            session={session}
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={v => { setSelectedVehicle(v); }}
            onVehiclesUpdated={setVehicles}
          />
        </div>
        <div style={{ display: tab === 'stats' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <StatsPage
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
          />
        </div>
      </div>

      {/* Bottom tab bar */}
      <div style={{
        display: 'flex',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg2)',
        flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {[
          { id: 'log', label: 'LOG', Icon: LogIcon },
          { id: 'stats', label: 'STATS', Icon: StatsIcon },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '12px 8px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              color: tab === id ? 'var(--accent)' : 'var(--text3)',
              transition: 'color 0.15s',
            }}
          >
            <Icon active={tab === id} />
            <span style={{ fontSize: '9px', letterSpacing: '0.1em' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
