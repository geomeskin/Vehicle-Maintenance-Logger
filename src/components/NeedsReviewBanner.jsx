export default function NeedsReviewBanner({ log, onEdit }) {
  return (
    <div style={{
      margin: '0 16px',
      padding: '12px 14px',
      background: '#1a1200',
      border: '1px solid #f97316',
      borderRadius: 'var(--radius)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    }}>
      <div>
        <div style={{ fontSize: '11px', color: '#f97316', letterSpacing: '0.05em', marginBottom: '2px' }}>
          LOW CONFIDENCE
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
          Claude wasn't sure about this entry. Tap to review.
        </div>
      </div>
      <button
        onClick={() => onEdit(log)}
        style={{
          padding: '8px 12px',
          background: '#f97316',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          fontWeight: '500',
          color: '#0a0a0a',
          letterSpacing: '0.05em',
          flexShrink: 0,
        }}
      >
        REVIEW
      </button>
    </div>
  );
}
