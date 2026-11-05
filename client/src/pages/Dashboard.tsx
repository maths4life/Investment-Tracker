import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import { AlertCircle } from 'lucide-react';
import { getDashboard, getPortfolioHistory } from '../lib/api';
import { useApi } from '../hooks/useApi';
import {
  formatINR, formatCompact, formatReturn, formatPL, formatDate,
  formatXIRR, plClass, returnClass, categoryColor, CATEGORY_COLORS,
} from '../lib/format';
import type { DashboardData, PortfolioPoint, AllocationItem } from '../types';

const RANGES = ['1M', '6M', '1Y', 'ALL'] as const;

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean; payload?: { name: string; value: number; color?: string }[];
  label?: string; formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-divider rounded px-3 py-2 text-xs">
      {label && <p className="text-muted mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#1F2328' }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload, targetAlloc }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: AllocationItem }[];
  targetAlloc?: Record<string, number>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const actualPct = item.pct * 100;
  const targetPct = targetAlloc?.[item.category];
  const diff = targetPct !== undefined ? actualPct - targetPct : null;

  return (
    <div className="bg-surface border border-divider rounded px-3 py-2 text-xs shadow-sm min-w-36">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-2 h-2 rounded-sm" style={{ background: categoryColor(item.category) }} />
        <p className="font-medium text-text">{item.category}</p>
      </div>
      <div className="space-y-0.5 text-muted">
        <div className="flex justify-between gap-4">
          <span>Value:</span>
          <span className="font-medium text-text tabular-nums">{formatINR(item.currentValue)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Invested:</span>
          <span className="tabular-nums">{formatINR(item.added)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Actual share:</span>
          <span className="font-medium text-text tabular-nums">{actualPct.toFixed(1)}%</span>
        </div>
        {targetPct !== undefined && diff !== null && (
          <div className="flex justify-between gap-4 pt-1 border-t border-divider text-[11px]">
            <span>Target:</span>
            <span className="tabular-nums">
              {targetPct}%{' '}
              <span className={diff >= 0 ? 'text-positive' : 'text-negative'}>
                ({diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`})
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, loading, error, refetch } = useApi<DashboardData>(getDashboard);
  const [range, setRange] = useState<string>('1Y');
  const { data: history, loading: histLoading } = useApi<PortfolioPoint[]>(
    useCallback(() => getPortfolioHistory(range), [range])
  );

  if (loading) return <div className="text-muted text-sm">Loading...</div>;
  if (error) return <div className="text-negative text-sm">Error: {error}</div>;
  if (!data) return null;

  const { totalValue, totalAdded, totalWithdrawn, profitLoss, returnPct, portfolioXIRR,
    allocation, best, worst, updatesDue, recentTransactions } = data;

  // ─── Chart data ───────────────────────────────────────────────────────────

  const histData = (history ?? []).map(p => ({
    date: formatDate(p.date),
    value: p.value / 100,
  }));

  const barData = allocation.map(a => ({
    name: a.category,
    'Total added': a.added / 100,
    'Current value': a.currentValue / 100,
  }));

  // Target allocations (from settings / API)
  const targetAlloc: Record<string, number> = data.targetAllocation || {};
  const hasTargets = Object.keys(targetAlloc).length > 0;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <div className="space-y-8 pb-16 md:pb-0">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section>
        <p className="text-sm text-muted mb-1">Portfolio value</p>
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="text-4xl font-medium text-text tabular-nums" style={{ fontSize: '36px' }}>
            {formatINR(totalValue)}
          </span>
          <span className={`text-base tabular-nums ${plClass(profitLoss)}`}>
            {formatPL(profitLoss)} {formatReturn(returnPct)}
          </span>
        </div>
      </section>

      <div className="border-t border-divider" />

      {/* ─── Updates Due ──────────────────────────────────────────────── */}
      {updatesDue.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <AlertCircle size={14} strokeWidth={1.5} className="text-[#C8665B]" />
            <h2 className="section-heading text-[14px]">Update due</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {updatesDue.map(inv => (
              <Link
                key={inv.id}
                to={`/investments/${inv.id}`}
                className="inline-flex items-center gap-1.5 text-xs border border-divider rounded px-2.5 py-1 text-muted hover:text-text hover:bg-fill"
              >
                {inv.name}
                <span className="text-muted">
                  {inv.daysSince !== null ? `${inv.daysSince}d ago` : 'never updated'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Allocation Donut + Returns ───────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Donut */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-heading">Allocation by category</h2>
            {hasTargets && (
              <span className="text-[11px] text-muted">Actual vs Target</span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative shrink-0 w-[200px] h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="currentValue"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={88}
                    paddingAngle={2}
                    strokeWidth={2}
                    stroke="#FFFFFF"
                    onMouseEnter={(_, index) => setActiveCategory(allocation[index]?.category ?? null)}
                    onMouseLeave={() => setActiveCategory(null)}
                  >
                    {allocation.map(item => (
                      <Cell
                        key={item.category}
                        fill={categoryColor(item.category)}
                        opacity={activeCategory && activeCategory !== item.category ? 0.45 : 1}
                        style={{ cursor: 'pointer', transition: 'opacity 150ms' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip targetAlloc={targetAlloc} />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Centre label */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center"
              >
                <p className="text-[11px] text-muted">
                  {activeCategory ? activeCategory : 'Total'}
                </p>
                <p className="text-sm font-medium tabular-nums text-text">
                  {formatCompact(
                    activeCategory
                      ? (allocation.find(a => a.category === activeCategory)?.currentValue ?? totalValue)
                      : totalValue
                  )}
                </p>
                {activeCategory && (
                  <p className="text-[11px] text-muted tabular-nums">
                    {((allocation.find(a => a.category === activeCategory)?.pct ?? 0) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>

            {/* Legend / Specifics breakdown */}
            <div className="flex-1 min-w-0 w-full space-y-2">
              {allocation.map(item => {
                const actualPct = item.pct * 100;
                const targetPct = targetAlloc[item.category];
                const diff = targetPct !== undefined ? actualPct - targetPct : null;
                const isHovered = activeCategory === item.category;

                return (
                  <div
                    key={item.category}
                    onMouseEnter={() => setActiveCategory(item.category)}
                    onMouseLeave={() => setActiveCategory(null)}
                    className={`p-1.5 -mx-1.5 rounded transition-colors cursor-pointer flex items-center justify-between text-xs ${
                      isHovered ? 'bg-fill' : 'hover:bg-fill/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ background: categoryColor(item.category) }}
                      />
                      <span className="font-medium text-text truncate">{item.category}</span>
                    </div>

                    <div className="flex items-baseline gap-2.5 shrink-0 text-right">
                      <span className="text-muted tabular-nums">{formatINR(item.currentValue)}</span>
                      <span className="font-medium tabular-nums text-text w-12 text-right">
                        {actualPct.toFixed(1)}%
                      </span>
                      {hasTargets && targetPct !== undefined && diff !== null && (
                        <span
                          className={`tabular-nums text-[11px] w-14 text-right ${
                            Math.abs(diff) < 0.1
                              ? 'text-muted'
                              : diff > 0
                              ? 'text-positive'
                              : 'text-negative'
                          }`}
                          title={`Target: ${targetPct}%`}
                        >
                          {diff > 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Returns overview */}
        <div>
          <h2 className="section-heading mb-4">Returns overview</h2>
          <table className="w-full text-sm">
            <tbody>
              {[
                ['Total added', formatINR(totalAdded), ''],
                ['Total withdrawn', formatINR(totalWithdrawn), ''],
                ['Current value', formatINR(totalValue), ''],
                ['Total P&L', formatPL(profitLoss), plClass(profitLoss)],
                ['Return', formatReturn(returnPct), returnClass(returnPct)],
                ['Portfolio XIRR', formatXIRR(portfolioXIRR), returnClass(portfolioXIRR)],
              ].map(([label, value, cls]) => (
                <tr key={label} className="border-b border-divider">
                  <td className="py-2 text-muted pr-4">{label}</td>
                  <td className={`py-2 tabular-nums font-medium text-right ${cls}`}>{value}</td>
                </tr>
              ))}
              {best && (
                <tr className="border-b border-divider">
                  <td className="py-2 text-muted pr-4">Best performer</td>
                  <td className="py-2 text-right">
                    <Link to={`/investments/${best.id}`} className="font-medium hover:underline text-positive">
                      {best.name}
                    </Link>
                    <span className="ml-2 text-muted text-xs tabular-nums">{formatReturn(best.returnPct)}</span>
                  </td>
                </tr>
              )}
              {worst && best?.id !== worst?.id && (
                <tr>
                  <td className="py-2 text-muted pr-4">Worst performer</td>
                  <td className="py-2 text-right">
                    <Link to={`/investments/${worst.id}`} className="font-medium hover:underline text-negative">
                      {worst.name}
                    </Link>
                    <span className="ml-2 text-muted text-xs tabular-nums">{formatReturn(worst.returnPct)}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="border-t border-divider" />

      {/* ─── Portfolio history line chart ──────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-heading">Portfolio value over time</h2>
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs px-2 py-1 rounded ${
                  range === r ? 'bg-text text-white' : 'text-muted hover:bg-fill'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {histLoading ? (
          <div className="h-48 flex items-center justify-center text-muted text-sm">Loading...</div>
        ) : histData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted text-sm">No data for this range</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={histData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false}
                interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false}
                tickFormatter={v => formatCompact(v * 100)} width={72} />
              <Tooltip content={<ChartTooltip formatter={v => formatINR(v * 100)} />} />
              <Line type="monotone" dataKey="value" name="Value" stroke="#6B8CAE" strokeWidth={2}
                dot={false} activeDot={{ r: 3, fill: '#6B8CAE' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="border-t border-divider" />

      {/* ─── Category bar chart ────────────────────────────────────────── */}
      <section>
        <h2 className="section-heading mb-4">Category: added vs current value</h2>
        <ResponsiveContainer width="100%" height={Math.max(barData.length * 48, 180)}>
          <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false}
              tickFormatter={v => formatCompact(v * 100)} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} width={96} />
            <Tooltip content={<ChartTooltip formatter={v => formatINR(v * 100)} />} />
            <Bar dataKey="Total added" fill="#D1D5DB" radius={[0, 2, 2, 0]} />
            <Bar dataKey="Current value" radius={[0, 2, 2, 0]}>
              {barData.map(entry => (
                <Cell key={entry.name} fill={categoryColor(entry.name)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <div className="border-t border-divider" />

      {/* ─── Recent transactions ───────────────────────────────────────── */}
      <section>
        <h2 className="section-heading mb-3">Recent activity</h2>
        {recentTransactions.length === 0 ? (
          <p className="text-muted text-sm">No transactions yet.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Investment</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map(tx => (
                <tr key={tx.id}>
                  <td className="text-muted">{formatDate(tx.date)}</td>
                  <td>
                    <Link to={`/investments/${tx.investment_id}`} className="hover:underline">
                      {tx.investment_name}
                    </Link>
                  </td>
                  <td className="text-muted capitalize">{tx.type.replace('_', ' ')}</td>
                  <td className={`text-right tabular-nums ${
                    tx.type === 'add' ? '' : tx.type === 'withdraw' ? 'text-negative' : 'text-muted'
                  }`}>
                    {formatINR(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

