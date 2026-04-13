const DEFAULT_KEY = 'vml-default-vehicle';

export function getDefaultVehicleId() {
  return localStorage.getItem(DEFAULT_KEY);
}

export function setDefaultVehicleId(id) {
  localStorage.setItem(DEFAULT_KEY, id);
}

export default function VehiclePicker({ vehicles, selected, onSelect }) {
  function handleSetDefault(e, v) {
    e.stopPropagation();
    setDefaultVehicleId(v.id);
    onSelect(v);
  }

  return (
    <div style={{ display: 'flex', gap: '10px', padding: '0 16px' }}>
      {vehicles.map((v) => {
        const isSelected = selected?.id === v.id;
        const isDefault = getDefaultVehicleId() === v.id;
        return (
          <div key={v.id} style={{ flex: 1, position: 'relative' }}>
            <button
              onClick={() => onSelect(v)}
              style={{
                width: '100%',
                padding: '12px 14px',
                paddingBottom: '28px',
                background: isSelected ? 'var(--accent)' : 'var(--bg2)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                textAlign: 'left',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
            >
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: isSelected ? '#0a0a0a' : 'var(--text)',
                fontFamily: 'var(--font-display)',
                marginBottom: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {v.name}
                {isDefault && (
                  <span style={{ marginLeft: '6px', fontSize: '9px', opacity: 0.7 }}>★ DEFAULT</span>
                )}
              </div>
              <div style={{
                fontSize: '11px',
                color: isSelected ? '#333' : 'var(--text2)',
              }}>
                {v.current_mileage > 0
                  ? `${v.current_mileage.toLocaleString()} mi`
                  : v.year || 'No data'}
              </div>
            </button>

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
  );
}
