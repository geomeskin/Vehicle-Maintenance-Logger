import { useState, useEffect } from 'react';
import { fetchStats } from '../api';

const STATUS_COLORS = {
  ok:           { bg: '#0a1a0a', border: '#22c55e', text: '#22c55e', label: 'OK' },
  due_soon:     { bg: '#1a1200', border: '#f97316', text: '#f97316', label: 'DUE SOON' },
  due_very_soon:{ bg: '#1a0f00', border: '#ef4444', text: '#ef4444', label: 'DUE VERY SOON' },
  overdue:      { bg: '#1a0a0a', border: '#ef4444', text: '#ef4444', label: 'OVERDUE' },
  unknown:      { bg: '#111',    border: '#444',    text: '#888',    label: 'NO DATA' },
};

function fmt$(val) {
  if (!val && val !== 0) return '—';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMi(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toLocaleString() + ' mi';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--bg2)',
      border: `1px solid ${color || 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: '800', color: color || 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function MpgChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text3)' }}>
        Need 2+ fill-ups with mileage to show MPG trend
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.mpg)) * 1.15;
  const min = Math.min(...data.map(d => d.mpg)) * 0.85;
  const range = max - min || 1;
  const w = 280;
  const h = 80;
  const pad = 8;

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.mpg - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <div style={{ padding: '0 4px' }}>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((d, i) => {
          const [x, y] = points[i].split(',');
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="var(--accent)" />
              <text x={x} y={Number(y) - 8} textAnchor="middle" fontSize="9" fill="var(--text2)">{d.mpg}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
        <span>{fmtDate(data[0]?.date)}</span>
        <span>{fmtDate(data[data.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function generatePDF(stats, vehicle) {
  // Build PDF as HTML and print
  const year = new Date().getFullYear();
  const { oilChange, costs, mpg, reminders, history } = stats;
  const oilStyle = STATUS_COLORS[oilChange.status] || STATUS_COLORS.unknown;

  const historyRows = history.slice(0, 25).map(h => `
    <tr>
      <td>${fmtDate(h.logged_at)}</td>
      <td>${h.logType === 'fuel' ? 'Fuel' : (h.category || '').replace('_', ' ')}</td>
      <td>${h.description || (h.gallons ? h.gallons + ' gal' : '—')}</td>
      <td>${fmtMi(h.mileage)}</td>
      <td>${fmt$(h.cost || h.total_cost)}</td>
    </tr>
  `).join('');

  const reminderRows = reminders.slice(0, 10).map(r => {
    const s = STATUS_COLORS[r.status] || STATUS_COLORS.unknown;
    return `
      <tr>
        <td>${(r.category || '').replace('_', ' ')}</td>
        <td>${r.description || '—'}</td>
        <td>${fmtMi(r.next_service_mileage)}</td>
        <td>${r.miles_until !== null ? (r.miles_until < 0 ? '⚠ ' : '') + fmtMi(Math.abs(r.miles_until)) + (r.miles_until < 0 ? ' overdue' : ' remaining') : '—'}</td>
        <td style="color:${s.text};font-weight:600">${s.label}</td>
      </tr>
    `;
  }).join('');

  const mpgRows = (mpg.data || []).map(f => `
    <tr>
      <td>${fmtDate(f.date)}</td>
      <td>${fmtMi(f.mileage)}</td>
      <td>${f.gallons} gal</td>
      <td>${fmtMi(f.miles_since_last)}</td>
      <td><strong>${f.mpg} MPG</strong></td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Vehicle Report — ${vehicle.name}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 12px; padding: 32px; }
        h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
        h2 { font-size: 14px; font-weight: 700; margin: 24px 0 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
        .meta { color: #888; font-size: 11px; margin-bottom: 24px; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 8px; }
        .stat-box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
        .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 4px; }
        .stat-value { font-size: 18px; font-weight: 800; }
        .stat-sub { font-size: 10px; color: #888; margin-top: 2px; }
        .oil-status { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; }
        th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; padding: 6px 8px; border-bottom: 2px solid #ddd; }
        td { padding: 7px 8px; border-bottom: 1px solid #f0f0f0; font-size: 11px; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
        @media print {
          @page { size: portrait; margin: 16px; }
          body { padding: 16px; }
          .page-break { page-break-before: always; }
        }

      </style>
    </head>
    <body>
      <h1>${vehicle.name}</h1>
      <div class="meta">
        ${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')} &nbsp;·&nbsp;
        ${vehicle.current_mileage ? vehicle.current_mileage.toLocaleString() + ' miles' : 'Mileage not set'} &nbsp;·&nbsp;
        Report generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>

      <h2>At a Glance</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Oil Change Status</div>
          <div class="stat-value">${fmtMi(oilChange.milesSinceOil) === '—' ? '—' : fmtMi(oilChange.milesSinceOil)}</div>
          <div class="stat-sub">since last change</div>
          <div style="margin-top:6px">
            <span class="oil-status" style="background:${oilStyle.bg};color:${oilStyle.text};border:1px solid ${oilStyle.border}">${oilStyle.label}</span>
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Maintenance — ${year}</div>
          <div class="stat-value">${fmt$(costs.maintenance.thisYear)}</div>
          <div class="stat-sub">${fmt$(costs.maintenance.allTime)} all time</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Fuel — ${year}</div>
          <div class="stat-value">${fmt$(costs.fuel.thisYear)}</div>
          <div class="stat-sub">${fmt$(costs.fuel.allTime)} all time</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Total Spent — ${year}</div>
          <div class="stat-value">${fmt$(costs.total.thisYear)}</div>
          <div class="stat-sub">${fmt$(costs.total.allTime)} all time</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Average MPG</div>
          <div class="stat-value">${mpg.average || '—'}</div>
          <div class="stat-sub">${mpg.fillUpsTracked} fill-ups tracked</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Last Oil Change</div>
          <div class="stat-value" style="font-size:13px">${fmtDate(oilChange.lastOilChange?.logged_at)}</div>
          <div class="stat-sub">${fmtMi(oilChange.lastOilChange?.mileage)}</div>
        </div>
      </div>

      ${reminders.length > 0 ? `
      <h2>Upcoming Service Reminders</h2>
      <table>
        <tr><th>Category</th><th>Description</th><th>Due At</th><th>Distance</th><th>Status</th></tr>
        ${reminderRows}
      </table>
      ` : ''}

      ${mpg.data.length > 0 ? `
      <h2>Fuel Economy</h2>
      <table>
        <tr><th>Date</th><th>Odometer</th><th>Gallons</th><th>Miles Driven</th><th>MPG</th></tr>
        ${mpgRows}
      </table>
      ` : ''}

      <div class="page-break"></div>

      <h2>Service History (last 25 entries)</h2>
      <table>
        <tr><th>Date</th><th>Type</th><th>Description</th><th>Mileage</th><th>Cost</th></tr>
        ${historyRows || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px">No entries yet</td></tr>'}
      </table>

      <div class="footer">
        Vehicle Maintenance Logger &nbsp;·&nbsp; ${vehicle.name} &nbsp;·&nbsp; Generated ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.document.body.style.width = '8.5in';
    win.print();
  }, 500);
}

export default function StatsPage({ vehicles, selectedVehicle, onSelectVehicle }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedVehicle) return;
    setLoading(true);
    setError(null);
    fetchStats(selectedVehicle.id)
      .then(data => setStats(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedVehicle?.id]);

  const oilStyle = stats ? (STATUS_COLORS[stats.oilChange.status] || STATUS_COLORS.unknown) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '480px', margin: '0 auto', overflow: 'hidden' }}>

      {/* Vehicle tabs */}
      <div style={{ display: 'flex', gap: '8px', padding: '14px 16px 0', flexShrink: 0 }}>
        {vehicles.map(v => (
          <button
            key={v.id}
            onClick={() => onSelectVehicle(v)}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: selectedVehicle?.id === v.id ? 'var(--accent)' : 'var(--bg2)',
              border: `1px solid ${selectedVehicle?.id === v.id ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              fontSize: '12px',
              fontWeight: '500',
              color: selectedVehicle?.id === v.id ? '#0a0a0a' : 'var(--text)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {v.name}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', fontSize: '12px', color: 'var(--text3)' }}>
            Loading stats...
          </div>
        )}

        {error && (
          <div style={{ padding: '12px', background: '#1a0a0a', border: '1px solid var(--red)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {stats && !loading && (
          <>
            {/* Oil change status */}
            <div style={{ marginBottom: '12px' }}>
              <SectionLabel>Oil Change</SectionLabel>
              <div style={{ background: oilStyle.bg, border: `1px solid ${oilStyle.border}`, borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: '800', color: oilStyle.text }}>
                    {stats.oilChange.milesSinceOil !== null ? fmtMi(stats.oilChange.milesSinceOil) : '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>
                    since last change {stats.oilChange.lastOilChange ? `(${fmtDate(stats.oilChange.lastOilChange.logged_at)})` : ''}
                  </div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: oilStyle.text, letterSpacing: '0.08em', background: oilStyle.bg, border: `1px solid ${oilStyle.border}`, padding: '4px 10px', borderRadius: '6px' }}>
                  {oilStyle.label}
                </div>
              </div>
            </div>

            {/* Cost stats */}
            <SectionLabel>Costs — {new Date().getFullYear()}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <StatCard label="Maintenance" value={fmt$(stats.costs.maintenance.thisYear)} sub={`${fmt$(stats.costs.maintenance.allTime)} all time`} />
              <StatCard label="Fuel" value={fmt$(stats.costs.fuel.thisYear)} sub={`${fmt$(stats.costs.fuel.allTime)} all time`} />
              <StatCard label="Total This Year" value={fmt$(stats.costs.total.thisYear)} color="var(--accent)" />
              <StatCard label="Total All Time" value={fmt$(stats.costs.total.allTime)} />
            </div>

            {/* MPG */}
            {stats.mpg.data.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <SectionLabel noMargin>MPG Trend</SectionLabel>
                  <span style={{ fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: '800', color: 'var(--accent)' }}>
                    {stats.mpg.average} avg
                  </span>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
                  <MpgChart data={stats.mpg.data} />
                </div>
              </div>
            )}

            {/* Cost by category */}
            {stats.costs.byCategory.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <SectionLabel>Spending by Category</SectionLabel>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  {stats.costs.byCategory.map((cat, i) => (
                    <div key={cat.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < stats.costs.byCategory.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text)', textTransform: 'capitalize' }}>{cat.category.replace('_', ' ')}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{cat.count}x</div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>{fmt$(cat.total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reminders */}
            {stats.reminders.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <SectionLabel>Upcoming Service</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.reminders.map(r => {
                    const s = STATUS_COLORS[r.status] || STATUS_COLORS.unknown;
                    return (
                      <div key={r.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--text)', textTransform: 'capitalize', marginBottom: '2px' }}>{r.category?.replace('_', ' ')} — {r.description}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Due at {fmtMi(r.next_service_mileage)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: s.text, letterSpacing: '0.05em' }}>{s.label}</div>
                          {r.miles_until !== null && (
                            <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>
                              {r.miles_until < 0 ? fmtMi(Math.abs(r.miles_until)) + ' over' : fmtMi(r.miles_until) + ' left'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PDF button */}
            <button
              onClick={() => generatePDF(stats, selectedVehicle)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '13px',
                fontWeight: '700',
                fontFamily: 'var(--font-display)',
                color: '#0a0a0a',
                letterSpacing: '0.05em',
                marginBottom: '16px',
              }}
            >
              GENERATE PDF REPORT
            </button>
          </>
        )}

        {!stats && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--text3)' }}>
            Select a vehicle to see stats
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children, noMargin }) {
  return (
    <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', marginTop: noMargin ? 0 : undefined }}>
      {children}
    </div>
  );
}
