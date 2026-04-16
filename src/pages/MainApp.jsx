import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { fetchVehicles, createVehicle } from '../api';
import { getDefaultVehicleId, setDefaultVehicleId } from '../components/VehiclePicker';
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

function SetPasswordModal({ onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Minimum 6 characters'); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: '#111',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', zIndex: 1000,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px',
        padding: '24px', width: '100%', maxWidth: '340px',
      }}>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 8px' }}>
          Set Password
        </h2>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>
          Set a password so you can sign in with email + password next time.
        </p>
        {success ? (
          <div style={{ background: '#1a2e1a', border: '1px solid #2a4a2a', borderRadius: '8px', padding: '16px', color: '#4ade80', fontSize: '14px' }}>
            Password set! You're all set. ✓
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            {error && <p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              style={{
                padding: '12px',
                background: loading || !password || !confirm ? '#333' : '#c8f135',
                color: loading || !password || !confirm ? '#666' : '#0f0f0f',
                border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: '700', cursor: 'pointer',
              }}
            >
              {loading ? 'Saving...' : 'Set Password'}
            </button>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AddVehicleScreen({ onVehicleAdded }) {
  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: '#111',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Vehicle name is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const vehicle = await createVehicle({
        name: name.trim(),
        make: make.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year) : null,
        current_mileage: mileage ? parseInt(mileage) : 0,
      });
      setDefaultVehicleId(vehicle.id);
      onVehicleAdded(vehicle);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--bg)',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontWeight: '800',
          fontSize: '28px', color: 'var(--accent)',
          letterSpacing: '-0.02em', marginBottom: '8px',
        }}>
          VML
        </div>
        <h2 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: '700', margin: '0 0 6px' }}>
          Add your first vehicle
        </h2>
        <p style={{ color: 'var(--text3)', fontSize: '13px', margin: '0 0 28px' }}>
          You can add more vehicles later.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
              NICKNAME <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder='e.g. "Blue Truck" or "Wife\'s Car"'
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                MAKE
              </label>
              <input
                type="text"
                placeholder="Ford"
                value={make}
                onChange={e => setMake(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                MODEL
              </label>
              <input
                type="text"
                placeholder="F-150"
                value={model}
                onChange={e => setModel(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                YEAR
              </label>
              <input
                type="number"
                placeholder="2020"
                value={year}
                onChange={e => setYear(e.target.value)}
                min="1900"
                max={new Date().getFullYear() + 1}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                CURRENT MILEAGE
              </label>
              <input
                type="number"
                placeholder="47000"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                min="0"
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div style={{ background: '#1a0a0a', border: '1px solid var(--red)', borderRadius: '8px', padding: '10px 14px', color: 'var(--red)', fontSize: '12px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              marginTop: '8px',
              padding: '14px',
              background: loading || !name.trim() ? '#333' : 'var(--accent)',
              color: loading || !name.trim() ? '#666' : '#0a0a0a',
              border: 'none', borderRadius: '8px',
              fontSize: '15px', fontWeight: '700',
              cursor: loading || !name.trim() ? 'default' : 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            {loading ? 'SAVING...' : 'ADD VEHICLE'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MainApp({ session }) {
  const [tab, setTab] = useState('log');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const [vehicleError, setVehicleError] = useState(null);

  useEffect(() => {
    if (!session) return;
    fetchVehicles()
      .then(vs => {
        setVehicles(vs);
        setVehiclesLoaded(true);
        if (vs.length > 0) {
          const defaultId = getDefaultVehicleId();
          const defaultVehicle = vs.find(v => v.id === defaultId) || vs[0];
          setSelectedVehicle(defaultVehicle);
        }
      })
      .catch(err => {
        console.error(err);
        setVehicleError(err.message);
        setVehiclesLoaded(true);
      });
  }, [session]);

  function handleVehicleAdded(vehicle) {
    setVehicles([vehicle]);
    setSelectedVehicle(vehicle);
  }

  // Still loading
  if (!vehiclesLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)', color: 'var(--text3)', fontSize: '13px' }}>
        Loading...
      </div>
    );
  }

  // New user — no vehicles yet
  if (vehiclesLoaded && vehicles.length === 0 && !vehicleError) {
    return <AddVehicleScreen onVehicleAdded={handleVehicleAdded} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {showSetPassword && <SetPasswordModal onClose={() => setShowSetPassword(false)} />}

      {vehicleError && (
        <div style={{
          background: '#1a0a0a', border: '1px solid #f87171',
          color: '#f87171', fontSize: '11px',
          padding: '8px 16px', flexShrink: 0,
        }}>
          Vehicle load error: {vehicleError}
        </div>
      )}

      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '18px', color: 'var(--accent)', letterSpacing: '-0.01em' }}>
          VML
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
          {session?.user?.email?.split('@')[0]}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setShowSetPassword(true)} style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.05em', padding: '4px 8px' }}>
            SET PW
          </button>
          <button onClick={() => supabase.auth.signOut()} style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.05em', padding: '4px 8px' }}>
            SIGN OUT
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: tab === 'log' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <HomePage
            session={session}
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={v => setSelectedVehicle(v)}
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

      <div style={{
        display: 'flex', borderTop: '1px solid var(--border)',
        background: 'var(--bg2)', flexShrink: 0,
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
              flex: 1, padding: '12px 8px 10px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '3px',
              background: 'none', border: 'none',
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
