'use client';

import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const formatDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatCurrency = (amount, country = 'IN') => {
  if (amount === undefined || amount === null) return null;
  const codes = { IN: '₹', US: '$', UK: '£', CA: 'C$', AU: 'A$' };
  const symbol = codes[country] || '₹';
  return `${symbol}${Number(amount).toLocaleString('en-US')}`;
};

function ChartTooltip({ active, payload, country }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>{formatDate(point.timestamp)}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{formatCurrency(point.price, country)}</div>
      {point.originalPrice != null && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatCurrency(point.originalPrice, country)}</div>
      )}
    </div>
  );
}

export default function PriceHistoryModal({ productId, apiBase, onClose }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${apiBase.replace(/\/+$/, '')}/api/products/${productId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Failed to load product');
        setProduct(json.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [productId, apiBase]);

  // Chart wants points sorted ascending with a plain numeric x — the raw priceHistory array is
  // already roughly chronological (see backfillPriceHistory.js's merge sort), but re-sort here
  // defensively so a badly-ordered document still renders a sane chart instead of a zig-zag mess.
  const chartData = useMemo(() => {
    if (!product?.priceHistory) return [];
    return [...product.priceHistory]
      .filter((p) => p.price != null && p.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((p) => ({ ...p, ts: new Date(p.timestamp).getTime() }));
  }, [product]);

  // Raw table, newest first — easier to spot "what changed most recently" than scrolling from 2019.
  const tableRows = useMemo(() => [...chartData].reverse(), [chartData]);

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card glass"
        style={{ width: 820, maxWidth: '100%', maxHeight: '90vh', background: '#ffffff', borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>show_chart</span>
              Price History
            </h3>
            {product && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={product.title}>
                {product.title}
              </div>
            )}
          </div>
          <button className="btn" style={{ padding: '4px 8px', background: 'transparent' }} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={{ padding: '1.2rem 1.5rem', overflowY: 'auto' }}>
          {loading && <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading price history…</div>}
          {error && <div style={{ padding: '3rem 0', textAlign: 'center', color: '#ef4444' }}>{error}</div>}

          {!loading && !error && chartData.length === 0 && (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4, display: 'block', marginBottom: 8 }}>timeline</span>
              No price history recorded for this product yet.
            </div>
          )}

          {!loading && !error && chartData.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Points</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{chartData.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Lowest</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(Math.min(...chartData.map((p) => p.price)), product.country)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Highest</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(Math.max(...chartData.map((p) => p.price)), product.country)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Range</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{formatDate(chartData[0].timestamp)} → {formatDate(chartData[chartData.length - 1].timestamp)}</div>
                </div>
              </div>

              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="ts"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      minTickGap={40}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v, product.country)}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      width={70}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<ChartTooltip country={product.country} />} />
                    <Line type="monotone" dataKey="price" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Raw data points ({tableRows.length})
                </h4>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--background)', zIndex: 1 }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>Price</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>MRP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>{formatDateTime(p.timestamp)}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.price, product.country)}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {p.originalPrice != null ? formatCurrency(p.originalPrice, product.country) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
