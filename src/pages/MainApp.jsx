import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { fetchVehicles, createVehicle, fetchServiceIntervals, saveServiceInterval, deleteServiceInterval } from '../api';
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 1000 }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '340px' }}>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 8px' }}>Set Password</h2>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>Set a password so you can sign in with email + password next time.</p>
        {success ? (
          <div style={{ background: '#1a2e1a', border: '1px solid #2a4a2a', borderRadius: '8px', padding: '16px', color: '#4ade80', fontSize: '14px' }}>
            Password set! You're all set. ✓
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            {error && <p style={{ color: '#f87171', fontSize: '13px', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading || !password || !confirm} style={{ padding: '12px', background: loading || !password || !confirm ? '#333' : '#c8f135', color: loading || !password || !confirm ? '#666' : '#0f0f0f', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
              {loading ? 'Saving...' : 'Set Password'}
            </button>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Service Intervals Modal ────────────────────────────────────────────────
function ServiceIntervalsModal({ vehicle, onClose }) {
  const [intervals, setIntervals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Oil change form state
  const [oilInterval, setOilInterval] = useState('');
  const [oilWarning, setOilWarning] = useState('');

  useEffect(() => {
    fetchServiceIntervals(vehicle.id)
      .then(data => {
        setIntervals(data);
        const oil = data.find(i => i.service_type === 'oil_change');
        if (oil) {
          setOilInterval(oil.interval_miles.toString());
          setOilWarning(oil.warning_threshold_miles.toString());
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [vehicle.id]);

  async function handleSave(e) {
    e.preventDefault();
    if (!oilInterval) { setError('Interval miles is required'); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveServiceInterval({
        vehicle_id: vehicle.id,
        service_type: 'oil_change',
        interval_miles: parseInt(oilInterval),
        warning_threshold_miles: oilWarning ? parseInt(oilWarning) : null,
      });
      setSuccess('Saved!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text3)',
    letterSpacing: '0.08em',
    display: 'block',
    marginBottom: '6px',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 1000 }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>Service Intervals</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>{vehicle.name}</p>

        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Oil Change */}
            <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent)', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '14px' }}>
                🛢 OIL CHANGE
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>CHANGE EVERY (MI)</label>
                  <input
                    type="number"
                    placeholder="10000"
                    value={oilInterval}
                    onChange={e => setOilInterval(e.target.value)}
                    min="100"
                    max="99999"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>WARN AT (MI)</label>
                  <input
                    type="number"
                    placeholder={oilInterval ? Math.round(parseInt(oilInterval) * 0.8).toString() : '8000'}
                    value={oilWarning}
                    onChange={e => setOilWarning(e.target.value)}
                    min="100"
                    max="99999"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>
                Leave "Warn At" blank to default to 80% of interval
              </div>
            </div>

            {/* Placeholder for future service types */}
            <div style={{ background: '#0f0f0f', border: '1px dashed #2a2a2a', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.06em' }}>
                More service types coming soon
              </div>
            </div>

            {error && (
              <div style={{ background: '#1a0a0a', border: '1px solid var(--red)', borderRadius: '8px', padding: '10px 14px', color: 'var(--red)', fontSize: '12px' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: '#0a1a0a', border: '1px solid var(--green)', borderRadius: '8px', padding: '10px 14px', color: 'var(--green)', fontSize: '12px' }}>
                ✓ {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !oilInterval}
              style={{
                padding: '13px',
                background: saving || !oilInterval ? '#333' : 'var(--accent)',
                color: saving || !oilInterval ? '#666' : '#0a0a0a',
                border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: '700',
                cursor: saving || !oilInterval ? 'default' : 'pointer',
                letterSpacing: '0.05em',
              }}
            >
              {saving ? 'SAVING...' : 'SAVE INTERVALS'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Add Vehicle Screen ─────────────────────────────────────────────────────
function AddVehicleScreen({ onVehicleAdded }) {
  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [oilInterval, setOilInterval] = useState('5000');
  const [oilWarning, setOilWarning] = useState('');
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

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--text3)',
    letterSpacing: '0.08em',
    display: 'block',
    marginBottom: '6px',
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

      // Save oil change interval if provided
      if (oilInterval) {
        await saveServiceInterval({
          vehicle_id: vehicle.id,
          service_type: 'oil_change',
          interval_miles: parseInt(oilInterval),
          warning_threshold_miles: oilWarning ? parseInt(oilWarning) : null,
        });
      }

      onVehicleAdded(vehicle);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '28px', color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          VML
        </div>
        <h2 style={{ color: 'var(--text)', fontSize: '20px', fontWeight: '700', margin: '0 0 6px' }}>
          Add your first vehicle
        </h2>
        <p style={{ color: 'var(--text3)', fontSize: '13px', margin: '0 0 28px' }}>
          You can add more vehicles and adjust settings later.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Nickname */}
          <div>
            <label style={labelStyle}>NICKNAME <span style={{ color: 'var(--red)' }}>*</span></label>
            <input
              type="text"
              placeholder={`e.g. "Blue Truck" or "Wifes Car"`}
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {/* Make / Model */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>MAKE</label>
              <input type="text" placeholder="Ford" value={make} onChange={e => setMake(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>MODEL</label>
              <input type="text" placeholder="F-150" value={model} onChange={e => setModel(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Year / Mileage */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>YEAR</label>
              <input type="number" placeholder="2020" value={year} onChange={e => setYear(e.target.value)} min="1900" max={new Date().getFullYear() + 1} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>CURRENT MILEAGE</label>
              <input type="number" placeholder="47000" value={mileage} onChange={e => setMileage(e.target.value)} min="0" style={inputStyle} />
            </div>
          </div>

          {/* Oil Change Interval */}
          <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '14px', marginTop: '4px' }}>
            <div style={{ fontSize: '12px', color: 'var(--accent)', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '12px' }}>
              🛢 OIL CHANGE INTERVAL
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>CHANGE EVERY (MI)</label>
                <input
                  type="number"
                  placeholder="5000"
                  value={oilInterval}
                  onChange={e => setOilInterval(e.target.value)}
                  min="100"
                  max="99999"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>WARN AT (MI)</label>
                <input
                  type="number"
                  placeholder={oilInterval ? Math.round(parseInt(oilInterval) * 0.8).toString() : '4000'}
                  value={oilWarning}
                  onChange={e => setOilWarning(e.target.value)}
                  min="100"
                  max="99999"
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>
              Leave "Warn At" blank to default to 80% of interval
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
              marginTop: '8px', padding: '14px',
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

// ── Main App ───────────────────────────────────────────────────────────────
export default function MainApp({ session }) {
  const [tab, setTab] = useState('log');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [showServiceIntervals, setShowServiceIntervals] = useState(false);
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

  if (!vehiclesLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)', color: 'var(--text3)', fontSize: '13px' }}>
        Loading...
      </div>
    );
  }

  if (vehiclesLoaded && vehicles.length === 0 && !vehicleError) {
    return <AddVehicleScreen onVehicleAdded={handleVehicleAdded} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {showSetPassword && <SetPasswordModal onClose={() => setShowSetPassword(false)} />}
      {showServiceIntervals && selectedVehicle && (
        <ServiceIntervalsModal vehicle={selectedVehicle} onClose={() => setShowServiceIntervals(false)} />
      )}

      {vehicleError && (
        <div style={{ background: '#1a0a0a', border: '1px solid #f87171', color: '#f87171', fontSize: '11px', padding: '8px 16px', flexShrink: 0 }}>
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
          <button
            onClick={() => setShowServiceIntervals(true)}
            style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.05em', padding: '4px 8px' }}
          >
            INTERVALS
          </button>
          <button
            onClick={() => setShowSetPassword(true)}
            style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.05em', padding: '4px 8px' }}
          >
            SET PW
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.05em', padding: '4px 8px' }}
          >
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

      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
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

