
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

function ServiceStatusModal({ vehicle, statusItems, onClose }) {
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', zIndex: 1000,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #333',
        borderRadius: '16px', padding: '24px',
        width: '100%', maxWidth: '380px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>
            Service Status
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 20px' }}>
          {vehicle.name} — {vehicle.current_mileage?.toLocaleString()} mi current
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {statusItems.map((item) => {
            const { color, label } = getStatusStyle(item.status);
            return (
              <div key={item.service_type} style={{
                background: '#111', border: '1px solid #2a2a2a',
                borderRadius: '10px', padding: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>
                    {SERVICE_LABELS[item.service_type] || item.service_type}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color, letterSpacing: '0.05em' }}>
                    {label}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: '20px', width: '100%', padding: '13px',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: '8px', color: 'var(--text2)',
            fontSize: '13px', fontWeight: '600',
            cursor: 'pointer', letterSpacing: '0.05em',
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}

export default function VehiclePicker({ vehicles, selected, onSelect }) {
  const [statusMap, setStatusMap] = useState({});
  const [showStatusModal, setShowStatusModal] = useState(null); // vehicle object
  const [modalItems, setModalItems] = useState([]);

  // Fetch status for all vehicles on mount and when vehicles change
  useEffect(() => {
    vehicles.forEach(v => {
      fetchServiceStatus(v.id)
        .then(items => {
          if (items.length > 0) {
            setStatusMap(prev => ({ ...prev, [v.id]: items }));
          }
        })
        .catch(() => {}); // silently ignore — no intervals configured
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
                <div style={{
                  fontSize: '13px', fontWeight: '500',
                  color: isSelected ? '#0a0a0a' : 'var(--text)',
                  fontFamily: 'var(--font-display)',
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'flex',
                  alignItems: 'center',
                }}>
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

              {/* Status alert button */}
              {hasAlert && (
                <button
                  onClick={(e) => handleBadgeClick(e, v)}
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '10px',
                    fontSize: '9px',
                    color: worstStatus === 'overdue' ? 'var(--red)' : '#f59e0b',
                    letterSpacing: '0.05em',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontWeight: '700',
                  }}
                >
                  {worstStatus === 'overdue' ? '🔴 OVERDUE' : '⚠️ DUE SOON'} →
                </button>
              )}

              {/* Set default button */}
              <button
                onClick={(e) => handleSetDefault(e, v)}
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '14px',
                  fontSize: '9px',
                  color: isSelected ? '#333' : 'var(--text3)',
                  letterSpacing: '0.05em',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
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