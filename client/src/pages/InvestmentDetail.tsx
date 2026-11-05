import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { getInvestment, getTransactions, getInvestmentHistory, createTransaction, updateTransaction, deleteTransaction } from '../lib/api';
import { useApi } from '../hooks/useApi';
import Modal from '../components/Modal';
import { formatINR, formatReturn, formatXIRR, formatDate, formatPL, plClass, returnClass } from '../lib/format';
import { today } from '../lib/format';
import type { InvestmentDetail, Transaction, PortfolioPoint } from '../types';

type ModalMode = 'add' | 'withdraw' | 'value_update' | 'edit' | null;
const RANGES = ['1M', '6M', '1Y', 'ALL'] as const;

export default function InvestmentDetail() {
  const { id } = useParams<{ id: string }>();
  const invId = parseInt(id ?? '', 10);

  const { data: inv, loading, error, refetch: refetchInv } = useApi<InvestmentDetail>(
    useCallback(() => getInvestment(invId), [invId])
  );
  const { data: txs, loading: txsLoading, refetch: refetchTxs } = useApi<Transaction[]>(
    useCallback(() => getTransactions(invId), [invId])
  );

  const [range, setRange] = useState('ALL');
  const { data: history, loading: histLoading } = useApi<PortfolioPoint[]>(
    useCallback(() => getInvestmentHistory(invId, range), [invId, range])
  );

  const [modal, setModal] = useState<ModalMode>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [filterNote, setFilterNote] = useState('');

  const refetch = () => { refetchInv(); refetchTxs(); };

  const handleDelete = async () => {
    if (!deleteTx) return;
    setDeleting(true);
    try {
      await deleteTransaction(deleteTx.id);
      setDeleteTx(null);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="text-muted text-sm">Loading...</div>;
  if (error) return <div className="text-negative text-sm">Error: {error}</div>;
  if (!inv) return null;

  const isStocks = inv.category === 'Stocks';

  // Apply filters locally (or could be server-side — simple enough here)
  const filtered = (txs ?? []).filter(tx => {
    if (filterType && tx.type !== filterType) return false;
    if (filterFrom && tx.date < filterFrom) return false;
    if (filterTo && tx.date > filterTo) return false;
    if (filterStock && (!tx.stock_name || !tx.stock_name.toLowerCase().includes(filterStock.toLowerCase()))) return false;
    if (filterNote && (!tx.note || !tx.note.toLowerCase().includes(filterNote.toLowerCase()))) return false;
    return true;
  });

  const histData = (history ?? []).map(p => ({
    date: formatDate(p.date),
    value: p.value / 100,
  }));

  return (
    <div className="space-y-8 pb-16 md:pb-0">
      {/* Back link */}
      <Link to="/investments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} strokeWidth={1.5} />
        Investments
      </Link>

      {/* ─── Header ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-muted mb-0.5">{inv.category}</p>
            <h1 className="text-[22px] font-medium text-text mb-1">{inv.name}</h1>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl font-medium tabular-nums">{formatINR(inv.currentValue)}</span>
              <span className={`text-sm tabular-nums ${plClass(inv.profitLoss)}`}>
                {formatPL(inv.profitLoss)} {formatReturn(inv.returnPct)}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setModal('add')}>
              <Plus size={13} strokeWidth={1.5} /> Add
            </button>
            <button className="btn" onClick={() => setModal('withdraw')}>
              <Minus size={13} strokeWidth={1.5} /> Withdraw
            </button>
            <button className="btn" onClick={() => setModal('value_update')}>
              <RefreshCw size={13} strokeWidth={1.5} /> Update value
            </button>
          </div>
        </div>

        {/* Key stats row */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-0 border border-divider rounded">
          {[
            ['Total added', formatINR(inv.totalAdded), ''],
            ['Total withdrawn', formatINR(inv.totalWithdrawn), ''],
            ['P&L', formatPL(inv.profitLoss), plClass(inv.profitLoss)],
            ['XIRR', formatXIRR(inv.xirr), returnClass(inv.xirr)],
          ].map(([label, value, cls], i) => (
            <div key={label} className={`px-4 py-3 ${i > 0 ? 'border-l border-divider' : ''}`}>
              <p className="text-xs text-muted mb-0.5">{label}</p>
              <p className={`text-sm font-medium tabular-nums ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── History chart ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-heading">Value over time</h2>
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs px-2 py-1 rounded ${range === r ? 'bg-text text-white' : 'text-muted hover:bg-fill'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {histLoading ? (
          <div className="h-32 flex items-center justify-center text-muted text-sm">Loading...</div>
        ) : histData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={histData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={72}
                tickFormatter={v => { const p = v * 100; if (Math.abs(p) >= 10_000_000) return `₹${(p/10_000_000).toFixed(1)}Cr`; if (Math.abs(p) >= 100_000) return `₹${(p/100_000).toFixed(0)}L`; return `₹${(p/1000).toFixed(0)}K`; }} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-surface border border-divider rounded px-3 py-2 text-xs">
                    <p className="text-muted mb-1">{label}</p>
                    <p className="font-medium">{formatINR(payload[0].value as number * 100)}</p>
                  </div>
                );
              }} />
              <Line type="monotone" dataKey="value" stroke="#7A9E7E" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ─── Stock Holdings (Stocks only) ──────────────────────────────── */}
      {isStocks && inv.holdings && inv.holdings.length > 0 && (
        <section>
          <h2 className="section-heading mb-3">Holdings</h2>
          <div className="overflow-x-auto border border-divider rounded">
            <table className="table-base w-full table-fixed">
              <thead>
                <tr className="bg-fill/50">
                  <th className="w-[20%] text-left">Stock</th>
                  <th className="w-[16%] text-right">Shares held</th>
                  <th className="w-[16%] text-right">Avg buy price</th>
                  <th className="w-[16%] text-right">Total cost</th>
                  <th className="w-[16%] text-right">Current price</th>
                  <th className="w-[16%] text-right">Current value</th>
                </tr>
              </thead>
              <tbody>
                {inv.holdings.map(h => (
                  <tr key={h.stockName}>
                    <td className="font-medium text-left truncate">{h.stockName}</td>
                    <td className="text-right tabular-nums">{h.sharesHeld.toFixed(4)}</td>
                    <td className="text-right tabular-nums">{formatINR(h.avgBuyPrice)}</td>
                    <td className="text-right tabular-nums">{formatINR(h.totalCost)}</td>
                    <td className="text-right tabular-nums text-muted">{h.currentPrice != null ? formatINR(h.currentPrice) : '–'}</td>
                    <td className="text-right tabular-nums font-medium">{h.currentValue != null ? formatINR(h.currentValue) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── Transaction history ───────────────────────────────────────── */}
      <section>
        <h2 className="section-heading mb-3">Transaction history</h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <select className="select w-auto text-xs" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            <option value="add">Add</option>
            <option value="withdraw">Withdraw</option>
            <option value="value_update">Value update</option>
          </select>
          <input type="date" className="input text-xs w-auto" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="From" />
          <input type="date" className="input text-xs w-auto" value={filterTo} onChange={e => setFilterTo(e.target.value)} placeholder="To" />
          {isStocks && (
            <input className="input text-xs w-32" value={filterStock} onChange={e => setFilterStock(e.target.value)} placeholder="Stock..." />
          )}
          <input className="input text-xs w-36" value={filterNote} onChange={e => setFilterNote(e.target.value)} placeholder="Note search..." />
          {(filterType || filterFrom || filterTo || filterStock || filterNote) && (
            <button className="text-xs text-muted hover:text-text" onClick={() => { setFilterType(''); setFilterFrom(''); setFilterTo(''); setFilterStock(''); setFilterNote(''); }}>
              Clear filters
            </button>
          )}
        </div>

        {txsLoading ? (
          <div className="text-muted text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-sm">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  {isStocks && <th>Stock</th>}
                  {isStocks && <th className="text-right">Shares</th>}
                  <th className="text-right">Amount</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id}>
                    <td className="text-muted whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        tx.type === 'add' ? 'bg-[#edf5f1] text-positive' :
                        tx.type === 'withdraw' ? 'bg-[#fdf2f1] text-negative' :
                        'bg-fill text-muted'
                      }`}>
                        {tx.type === 'value_update' ? 'Value update' : tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                      </span>
                    </td>
                    {isStocks && <td className="text-muted">{tx.stock_name ?? '–'}</td>}
                    {isStocks && <td className="text-right tabular-nums text-muted">{tx.shares ?? '–'}</td>}
                    <td className={`text-right tabular-nums font-medium ${
                      tx.type === 'withdraw' ? 'text-negative' : ''
                    }`}>
                      {formatINR(tx.amount)}
                    </td>
                    <td className="text-muted text-xs max-w-[200px] truncate">{tx.note ?? '–'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="p-1 rounded hover:bg-fill text-muted hover:text-text"
                          onClick={() => { setEditTx(tx); setModal('edit'); }}
                        >
                          <Edit2 size={13} strokeWidth={1.5} />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-fill text-muted hover:text-negative"
                          onClick={() => setDeleteTx(tx)}
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Modals ────────────────────────────────────────────────────── */}
      <TxModal
        open={modal === 'add' || modal === 'withdraw' || modal === 'value_update'}
        mode={modal as 'add' | 'withdraw' | 'value_update'}
        investmentId={invId}
        isStocks={isStocks}
        onClose={() => setModal(null)}
        onSaved={refetch}
      />

      {editTx && (
        <TxModal
          open={modal === 'edit'}
          mode="edit"
          investmentId={invId}
          isStocks={isStocks}
          initialTx={editTx}
          onClose={() => { setModal(null); setEditTx(null); }}
          onSaved={refetch}
        />
      )}

      <Modal open={!!deleteTx} onClose={() => setDeleteTx(null)} title="Delete transaction">
        <p className="text-sm text-muted mb-4">
          Delete this {deleteTx?.type?.replace('_', ' ')} of {deleteTx ? formatINR(deleteTx.amount) : ''} on {deleteTx ? formatDate(deleteTx.date) : ''}?
          All derived metrics will be recalculated.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={() => setDeleteTx(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Transaction Modal ───────────────────────────────────────────────────────

interface TxModalProps {
  open: boolean;
  mode: 'add' | 'withdraw' | 'value_update' | 'edit';
  investmentId: number;
  isStocks: boolean;
  initialTx?: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

function TxModal({ open, mode, investmentId, isStocks, initialTx, onClose, onSaved }: TxModalProps) {
  const isEdit = mode === 'edit';
  const txType = isEdit ? (initialTx?.type ?? 'add') : mode;
  const showStockFields = isStocks && (txType === 'add' || txType === 'withdraw');

  const [date, setDate] = useState(isEdit && initialTx ? initialTx.date : today());
  const [amountStr, setAmountStr] = useState(isEdit && initialTx ? String((initialTx.amount / 100).toFixed(2)) : '');
  const [note, setNote] = useState(isEdit && initialTx ? (initialTx.note ?? '') : '');
  const [stockName, setStockName] = useState(isEdit && initialTx ? (initialTx.stock_name ?? '') : '');
  const [sharesStr, setSharesStr] = useState(isEdit && initialTx && initialTx.shares ? String(initialTx.shares) : '');
  const [priceStr, setPriceStr] = useState(isEdit && initialTx && initialTx.price_per_share ? String((initialTx.price_per_share / 100).toFixed(2)) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset on open
  const handleOpen = () => {
    if (!open) return;
    if (!isEdit) {
      setDate(today());
      setAmountStr('');
      setNote('');
      setStockName('');
      setSharesStr('');
      setPriceStr('');
    }
    setError('');
  };

  const title = isEdit ? 'Edit transaction' : {
    add: 'Add money', withdraw: 'Withdraw', value_update: 'Update value',
  }[mode as string] ?? 'Transaction';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountRaw = parseFloat(amountStr);
    if (isNaN(amountRaw) || amountRaw <= 0) { setError('Enter a valid positive amount'); return; }
    if (!date) { setError('Date is required'); return; }

    const amountPaise = Math.round(amountRaw * 100);
    const shares = sharesStr ? parseFloat(sharesStr) : undefined;
    const pricePaise = priceStr ? Math.round(parseFloat(priceStr) * 100) : undefined;

    const payload = {
      type: txType as 'add' | 'withdraw' | 'value_update',
      date,
      amount: amountPaise,
      note: note.trim() || null,
      stock_name: stockName.trim() || null,
      shares: shares ?? null,
      price_per_share: pricePaise ?? null,
    };

    setSubmitting(true);
    try {
      if (isEdit && initialTx) {
        await updateTransaction(initialTx.id, payload);
      } else {
        await createTransaction(investmentId, payload);
      }
      onClose();
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setError(''); }} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} max={today()}
              onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input className="input" type="number" min="0" step="0.01"
              value={amountStr} onChange={e => setAmountStr(e.target.value)}
              placeholder="0.00" />
          </div>
        </div>

        {showStockFields && (
          <>
            <div>
              <label className="label">Stock name / ticker</label>
              <input className="input" value={stockName} onChange={e => setStockName(e.target.value)} placeholder="e.g. HDFC Bank" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Shares</label>
                <input className="input" type="number" min="0" step="0.0001"
                  value={sharesStr} onChange={e => setSharesStr(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="label">Price per share (₹, optional)</label>
                <input className="input" type="number" min="0" step="0.01"
                  value={priceStr} onChange={e => setPriceStr(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note" />
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Save changes' : title}
          </button>
        </div>
      </form>
    </Modal>
  );
}

