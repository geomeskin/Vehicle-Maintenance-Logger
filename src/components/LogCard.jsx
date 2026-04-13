import { useState } from 'react';

const CATEGORY_LABELS = {
  oil_change:  'Oil Change',
  tires:       'Tires',
  brakes:      'Brakes',
  repair:      'Repair',
  fluid:       'Fluid',
  inspection:  'Inspection',
  other:       'Other',
};

const CATEGORY_COLORS = {
  oil_change:  '#f97316',
  tires:       '#3b82f6',
  brakes:      '#ef4444',
  repair:      '#a855f7',
  fluid:       '#06b6d4',
  inspection:  '#22c55e',
  other:       '#888888',
  fuel:        '#e8ff47',
};

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10c0 3.866 3.134 7 7 7s7-3.134 7-7"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}

function FuelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 22V8l7-6 7 6v14H3z"/>
      <path d="M17 8l3 2v5a1 1 0 01-2 0v-4l-1-1"/>
      <rect x="7" y="14" width="6" height="8"/>
    </svg>
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCost(val) {
  if (!val) return null;
  return `$${Number(val).toFixed(2)}`;
}

export default function LogCard({ log, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const isFuel = log.logType === 'fuel';
  const color = isFuel ? CATEGORY_COLORS.fuel : (CATEGORY_COLORS[log.category] || CATEGORY_COLORS.other);
  const label = isFuel ? 'Fuel' : (CATEGORY_LABELS[log.category] || 'Other');

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'visible',
    }}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'left',
          background: 'none',
          borderRadius: 'var(--radius)',
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />

        <div style={{ color: color, flexShrink: 0 }}>
          {isFuel ? <FuelIcon /> : <MicIcon />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{
              fontSize: '11px',
              background: color + '22',
              color: color,
              padding: '2px 7px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em',
              flexShrink: 0,
            }}>
              {label}
            </span>
            {log.mileage && (
              <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                {log.mileage.toLocaleString()} mi
              </span>
            )}
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text)',
            whiteSpace: expanded ? 'normal' : 'nowrap',
            overflow: expanded ? 'visible' : 'hidden',
            textOverflow: expanded ? 'clip' : 'ellipsis',
          }}>
            {isFuel
              ? `${log.gallons ? log.gallons + ' gal' : ''} ${log.station_name || ''}`.trim() || 'Fuel fill-up'
              : log.description}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {(log.cost || log.total_cost) && (
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>
              {formatCost(log.cost || log.total_cost)}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
            {formatDate(log.logged_at)}
          </div>
        </div>

        <div style={{
          color: 'var(--text3)',
          fontSize: '10px',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          flexShrink: 0,
        }}>▼</div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {isFuel ? (
            <>
              {log.gallons && <DetailRow label="gallons" value={log.gallons} />}
              {log.price_per_gallon && <DetailRow label="price/gal" value={`$${log.price_per_gallon}`}
