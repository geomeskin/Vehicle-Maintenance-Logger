import { useState, useEffect } from 'react';
import { fetchServiceStatus } from '../api';

const DEFAULT_KEY = 'vml-default-vehicle';

export function getDefaultVehicleId() {
  return localStorage.getItem(DEFAULT_KEY);
}

export function setDefaultVehicleId(id) {
  localStorage.setItem(DEFAULT_KEY, id);
}

const SERVICE_LABELS = {
  oil_change: 'Oil Change',
  tires: 'Tire Rotation',
  brakes: 'Brakes',
  inspection: 'Inspection',
  fluid: 'Fluid',
  other: 'Other',
};

const SERVICE_CATEGORIES = {
  oil_change: 'oil_change',
  tires: 'tires',
  brakes: 'brakes',
  inspection: 'inspection',
  fluid: 'fluid',
  other: 'other',
};

function StatusBadge({ status }) {
  if (!status || status === 'ok') return null;
  const isOverdue = status === 'overdue';
  return (
    <span style={{
      display: 'inline-block',
      width: '8px', height: '8px',
      borderRadius: '50%',
      background: isOverdue ? 'var(--red)' : '#f59e0b',
      marginLeft: '6px',
      verticalAlign: 'middle',
      flexShrink: 0,
    }} />
  );
}

function QuickLogForm({ vehicle, item, onSaved, onCancel }) {
  const [mileage, setMileage] = useState(vehicle.current_mileage?.toString() || '');
  const [cost, setCost] = useState('');
  const [shopName, setShopName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '15px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle = {
    fontSize: '10px',
    color: 'var(--text3)',
    letterSpacing: '0.08em',
    display: 'block',
    marginBottom: '5px',
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { saveMaintenanceLog } = await import('../api');
      const log = await saveMaintenanceLog({
        vehicleId: vehicle.id,
        category: SERVICE_CATEGORIES[item.service_type] || 'other',
        description: `${SERVICE_LABELS[item.service_type] || item.service_type} — quick log`,
        mileage: mileage || null,
        cost: cost || null,
        shopName: shopName || null,
        notes: notes || null,
      });
      onSaved(log);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.06em', marginBottom: '4px' }}>
        ✏️ QUICK LOG — {SERVICE_LABELS[item.service_type] || item.service_type}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>MILEAGE</label>
          <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>COST ($)</label>
          <input type="number" placeholder="0.00" value={cost} onChange={e => setCost(e.target.value)} step="0.01" style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>SHOP NAME</label>
        <input type="text" placeholder="Jiffy Lube..." value={shopName} onChange={e => setShopName(e.target.value)} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>NOTES</label>
        <input type="text" placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} />
      </div>

      {error && (
        <div style={{ background: '#1a0a0a', border: '1px solid var(--red)', borderRadius: '8px', padding: '8px 12px', color: 'var(--red)', fontSize: '12px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '11px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
        >
          CANCEL
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 2, padding: '11px', background: saving ? '#333' : 'var(--accent)', border: 'none', borderRadius: '8px', color: saving ? '#666' : '#0a0a0a', fontSize: '12px', fontWeight: '700', cursor: saving ? 'default' : 'pointer', letterSpacing: '0.05em' }}
        >
          {saving ? 'SAVING...' : 'SAVE LOG'}
        </button>
      </div>
    </div>
  );
}

function ServiceStatusModal({ vehicle, statusItems, onClose, onVoiceLog, onQuickLogSaved }) {
  const [quickLogItem, setQuickLogItem] = useState(null);

  const labelStyle = {
    fontSize: '10px',
    color: 'var(--text3)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };

  function getStatusStyle(status) {
    if (status === 'overdue') return { color: 'var(--red)', label: '🔴 OVERDUE' };
    if (status === 'due_soon') return { color: '#f59e0b', label: '⚠️ DUE SOON' };
    if (status === 'unknown') return { color: 'var(--text3)', label: '— NO DATA' };
    return { color: 'var(--green)', label: '✅ OK' };
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 1000 }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px', maxHeight: '85vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>Service Status</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>
          {vehicle.name} — {vehicle.current_mileage?.toLocaleString()} mi current
        </p>

        {quickLogItem ? (
          <QuickLogForm
            vehicle={vehicle}
            item={quickLogItem}
            onSaved={(log) => {
              setQuickLogItem(null);
              onQuickLogSaved(log);
            }}
            onCancel={() => setQuickLogItem(null)}
          />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {statusItems.map((item) => {
                const { color, label } = getStatusStyle(item.status);
                const isActionable = item.status === 'overdue' || item.status === 'due_soon';
                return (
                  <div key={item.service_type} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                        {SERVICE_LABELS[item.service_type] || item.service_type}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color, letterSpacing: '0.05em' }}>
                        {label}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: isActionable ? '14px' : '0' }}>
                      <div>
                        <div style={labelStyle}>Last Done</div>
                        <div style={{ fontSize: '13px', color: 'var(--text)', marginTop: '2px' }}>
                          {item.last_mileage ? `${item.last_mileage.toLocaleString()} mi` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={labelStyle}>Miles Since</div>
                        <div style={{ fontSize: '13px', color: 'var(--text)', marginTop: '2px' }}>
                          {item.miles_since_last !== null ? `${item.miles_since_last.toLocaleString()} mi` : '—'}
                        </div>
                      </div>
                      <div>
                        <div style={labelStyle}>Interval</div>
                        <div style={{ fontSize: '13px', color: 'var(--text)', marginTop: '2px' }}>
                          {item.interval_miles.toLocaleString()} mi
                        </div>
                      </div>
                      <div>
                        <div style={labelStyle}>Miles Left</div>
                        <div style={{ fontSize: '13px', color: item.miles_remaining !== null && item.miles_remaining <= 0 ? 'var(--red)' : 'var(--text)', marginTop: '2px' }}>
                          {item.miles_remaining !== null
                            ? item.miles_remaining <= 0
                              ? `${Math.abs(item.miles_remaining).toLocaleString()} over`
                              : `${item.miles_remaining.toLocaleString()} mi`
                            : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons — only shown when due or overdue */}
                    {isActionable && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => { onClose(); onVoiceLog(item); }}
                          style={{
                            flex: 1, padding: '10px 8px',
                            background: 'var(--bg2)', border: '1px solid var(--border)',
                            borderRadius: '8px', color: 'var(--text2)',
                            fontSize: '11px', fontWeight: '600',
                            cursor: 'pointer', letterSpacing: '0.04em',
                          }}
                        >
                          🎙 LOG BY VOICE
                        </button>
                        <button
                          onClick={() => setQuickLogItem(item)}
                          style={{
                            flex: 1, padding: '10px 8px',
                            background: 'var(--accent)', border: 'none',
                            borderRadius: '8px', color: '#0a0a0a',
                            fontSize: '11px', fontWeight: '700',
                            cursor: 'pointer', letterSpacing: '0.04em',
                          }}
                        >
                          ✏️ QUICK LOG
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={onClose}
              style={{ marginTop: '20px', width: '100%', padding: '13px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.05em' }}
            >
              CLOSE
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VehiclePicker({ vehicles, selected, onSelect, onVoiceLog, onQuickLogSaved }) {
  const [statusMap, setStatusMap] = useState({});
  const [showStatusModal, setShowStatusModal] = useState(null);
  const [modalItems, setModalItems] = useState([]);

  useEffect(() => {
    vehicles.forEach(v => {
      fetchServiceStatus(v.id)
        .then(items => {
          if (items.length > 0) {
            setStatusMap(prev => ({ ...prev, [v.id]: items }));
          }
        })
        .catch(() => {});
    });
  }, [vehicles.map(v => v.id).join(',')]);

  function getWorstStatus(items) {
    if (!items || items.length === 0) return 'ok';
    if (items.some(i => i.status === 'overdue')) return 'overdue';
    if (items.some(i => i.status === 'due_soon')) return 'due_soon';
    return 'ok';
  }

  function handleBadgeClick(e, v) {
    e.stopPropagation();
    setModalItems(statusMap[v.id] || []);
    setShowStatusModal(v);
  }

  function handleSetDefault(e, v) {
    e.stopPropagation();
    setDefaultVehicleId(v.id);
    onSelect(v);
  }

  return (
    <>
      {showStatusModal && (
        <ServiceStatusModal
          vehicle={showStatusModal}
          statusItems={modalItems}
          onClose={() => setShowStatusModal(null)}
          onVoiceLog={(item) => {
            setShowStatusModal(null);
            if (onVoiceLog) onVoiceLog(item);
          }}
          onQuickLogSaved={(log) => {
            setShowStatusModal(null);
            if (onQuickLogSaved) onQuickLogSaved(log);
          }}
        />
      )}

      <div style={{ display: 'flex', gap: '10px', padding: '0 16px' }}>
        {vehicles.map((v) => {
          const isSelected = selected?.id === v.id;
          const isDefault = getDefaultVehicleId() === v.id;
          const items = statusMap[v.id] || [];
          const worstStatus = getWorstStatus(items);
          const hasAlert = worstStatus === 'overdue' || worstStatus === 'due_soon';

          return (
            <div key={v.id} style={{ flex: 1, position: 'relative' }}>
              <button
                onClick={() => onSelect(v)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  paddingBottom: '28px',
                  background: isSelected ? 'var(--accent)' : 'var(--bg2)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : hasAlert ? (worstStatus === 'overdue' ? 'var(--red)' : '#f59e0b') : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '500', color: isSelected ? '#0a0a0a' : 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: '2px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.name}
                  </span>
                  {isDefault && (
                    <span style={{ marginLeft: '6px', fontSize: '9px', opacity: 0.7, flexShrink: 0 }}>★</span>
                  )}
                  <StatusBadge status={worstStatus} />
                </div>
                <div style={{ fontSize: '11px', color: isSelected ? '#333' : 'var(--text2)' }}>
                  {v.current_mileage > 0
                    ? `${v.current_mileage.toLocaleString()} mi`
                    : v.year || 'No data'}
                </div>
              </button>

              {hasAlert && (
                <button
                  onClick={(e) => handleBadgeClick(e, v)}
                  style={{
                    position: 'absolute', bottom: '8px', right: '10px',
                    fontSize: '9px',
                    color: worstStatus === 'overdue' ? 'var(--red)' : '#f59e0b',
                    letterSpacing: '0.05em', background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', fontWeight: '700',
                  }}
                >
                  {worstStatus === 'overdue' ? '🔴 OVERDUE' : '⚠️ DUE SOON'} →
                </button>
              )}

              <button
                onClick={(e) => handleSetDefault(e, v)}
                style={{
                  position: 'absolute', bottom: '8px', left: '14px',
                  fontSize: '9px', color: isSelected ? '#333' : 'var(--text3)',
                  letterSpacing: '0.05em', background: 'none', border: 'none',
                  padding: 0, cursor: 'pointer',
                }}
              >
                {isDefault ? '★ DEFAULT' : 'SET DEFAULT'}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
