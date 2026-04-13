export default function VehiclePicker({ vehicles, selected, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '0 16px' }}>
      {vehicles.map((v) => {
        const isSelected = selected?.id === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            style={{
              flex: 1,
              padding: '12px 14px',
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
            </div>
            <div style={{
              fontSize: '11px',
              color: isSelected ? '#333' : 'var(--text2)',
              fontFamily: 'var(--font-mono)',
            }}>
              {v.current_mileage > 0
                ? `${v.current_mileage.toLocaleString()} mi`
                : v.year || 'No data'}
            </div>
          </button>
        );
      })}
    </div>
  );
}
