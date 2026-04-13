import { useState } from 'react';
import { updateLog } from '../api';

const MAINTENANCE_FIELDS = [
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'category', label: 'Category', type: 'select',
    options: ['oil_change','tires','brakes','repair','fluid','inspection','other'] },
  { key: 'mileage', label: 'Mileage', type: 'number' },
  { key: 'cost', label: 'Total Cost ($)', type: 'number' },
  { key: 'labor_cost', label: 'Labor Cost ($)', type: 'number' },
  { key: 'parts_cost', label: 'Parts Cost ($)', type: 'number' },
  { key: 'shop_name', label: 'Shop Name', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'next_service_mileage', label: 'Next Service (mi)', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const FUEL_FIELDS = [
  { key: 'gallons', label: 'Gallons', type: 'number' },
  { key: 'price_per_gallon', label: 'Price/Gallon ($)', type: 'number' },
  { key: 'total_cost', label: 'Total Cost ($)', type: 'number' },
  { key: 'fuel_grade', label: 'Grade', type: 'select',
    options: ['regular','mid','premium','diesel'] },
  { key: 'mileage', label: 'Mileage', type: 'number' },
  { key: 'miles_since_last', label: 'Miles Since Last', type: 'number' },
  { key: 'station_name', label: 'Station', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function EditModal({ log, onClose, onSaved }) {
  const fields = log.logType === 'fuel' ? FUEL_FIELDS : MAINTENANCE_FIELDS;
  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach(f => {
      init[f.key] = log[f.key] ?? '';
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(key, val) {
    setValues(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Only send non-empty values
      const updates = {};
      fields.forEach(f => {
        const v = values[f.key];
        if (v !== '' && v !== null && v !== undefined) {
          updates[f.key] = f.type === 'number' ? Number(v) : v;
        }
      });
      const result = await updateLog(log.id, log.logType, updates);
      onSaved(result.updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 16px 32px',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{
          width: '36px', height: '4px',
          background: 'var(--border2)',
          borderRadius: '2px',
          margin: '0 auto 20px',
        }} />

        <div style={{
          fontSize: '14px',
          fontFamily: 'var(--font-display)',
          fontWeight: '700',
          color: 'var(--text)',
          marginBottom: '16px',
          letterSpacing: '0.02em',
        }}>
          EDIT {log.logType.toUpperCase()} LOG
        </div>

        {fields.map(f => (
          <div key={f.key} style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              fontSize: '10px',
              color: 'var(--text2)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}>
              {f.label}
            </label>

            {f.type === 'select' ? (
              <select
                value={values[f.key]}
                onChange={e => handleChange(f.key, e.target.value)}
                style={inputStyle}
              >
                <option value="">—</option>
                {f.options.map(o => (
                  <option key={o} value={o}>{o.replace('_', ' ')}</option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                value={values[f.key]}
                onChange={e => handleChange(f.key, e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            ) : (
              <input
                type={f.type}
                value={values[f.key]}
                onChange={e => handleChange(f.key, e.target.value)}
                style={inputStyle}
              />
            )}
          </div>
        ))}

        {error && (
          <div style={{
            padding: '10px 12px',
            background: '#1a0a0a',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--red)',
            fontSize: '12px',
            marginBottom: '12px',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              background: 'var(--bg3)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius)',
              fontSize: '12px',
              letterSpacing: '0.05em',
              color: 'var(--text2)',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2,
              padding: '14px',
              background: saving ? 'var(--bg3)' : 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '12px',
              letterSpacing: '0.05em',
              fontWeight: '500',
              color: saving ? 'var(--text2)' : '#0a0a0a',
              transition: 'all 0.15s',
            }}
          >
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '13px',
  color: 'var(--text)',
  outline: 'none',
};
