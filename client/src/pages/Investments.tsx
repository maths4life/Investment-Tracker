import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MoreHorizontal, Trash2, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getInvestments, createInvestment, deleteInvestment } from '../lib/api';
import { useApi } from '../hooks/useApi';
import Modal from '../components/Modal';
import { formatINR, formatReturn, formatXIRR, formatDate, plClass, returnClass } from '../lib/format';
import { CATEGORIES, type Category, type InvestmentWithMetrics } from '../types';

type SortKey = 'name' | 'currentValue' | 'profitLoss' | 'returnPct' | 'lastUpdated';

export default function Investments() {
  const { data: investments, loading, error, refetch } = useApi<InvestmentWithMetrics[]>(getInvestments);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('currentValue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvestmentWithMetrics | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <div className="text-muted text-sm">Loading...</div>;
  if (error) return <div className="text-negative text-sm">Error: {error}</div>;
  if (!investments) return null;

  const filtered = investments
    .filter(inv => {
      if (categoryFilter && inv.category !== categoryFilter) return false;
      if (search && !inv.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let va: number | string = a[sortKey] ?? 0;
      let vb: number | string = b[sortKey] ?? 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInvestment(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    sortKey === k ? <ChevronDown size={12} className={`inline ml-0.5 ${sortDir === 'asc' ? 'rotate-180' : ''}`} /> : null
  );

  return (
    <div className="space-y-6 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="section-heading text-[16px]">Investments</h1>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={14} strokeWidth={1.5} />
          Add investment
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="select w-auto" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as Category | '')}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-muted text-sm">
          {investments.length === 0 ? 'No investments yet. Add your first investment.' : 'No matches found.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="cursor-pointer" onClick={() => toggleSort('name')}>Name <SortIcon k="name" /></th>
                <th>Category</th>
                <th className="cursor-pointer text-right" onClick={() => toggleSort('currentValue')}>Current value <SortIcon k="currentValue" /></th>
                <th className="text-right">Total added</th>
                <th className="cursor-pointer text-right" onClick={() => toggleSort('profitLoss')}>P&L <SortIcon k="profitLoss" /></th>
                <th className="cursor-pointer text-right" onClick={() => toggleSort('returnPct')}>Return <SortIcon k="returnPct" /></th>
                <th className="text-right">XIRR</th>
                <th className="cursor-pointer text-right" onClick={() => toggleSort('lastUpdated')}>Last updated <SortIcon k="lastUpdated" /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {inv.updateDue && <span className="w-1.5 h-1.5 rounded-full bg-negative shrink-0" title="Update due" />}
                      <Link to={`/investments/${inv.id}`} className="font-medium hover:underline">
                        {inv.name}
                      </Link>
                    </div>
                  </td>
                  <td className="text-muted">{inv.category}</td>
                  <td className="text-right tabular-nums font-medium">{formatINR(inv.currentValue)}</td>
                  <td className="text-right tabular-nums text-muted">{formatINR(inv.totalAdded)}</td>
                  <td className={`text-right tabular-nums ${plClass(inv.profitLoss)}`}>
                    {inv.profitLoss >= 0 ? '+' : '−'}{formatINR(Math.abs(inv.profitLoss))}
                  </td>
                  <td className={`text-right tabular-nums ${returnClass(inv.returnPct)}`}>
                    {formatReturn(inv.returnPct)}
                  </td>
                  <td className={`text-right tabular-nums ${returnClass(inv.xirr)}`}>
                    {formatXIRR(inv.xirr)}
                  </td>
                  <td className="text-right text-muted">{inv.lastUpdated ? formatDate(inv.lastUpdated) : '—'}</td>
                  <td>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="p-1 rounded hover:bg-fill text-muted hover:text-text">
                          <MoreHorizontal size={15} strokeWidth={1.5} />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="bg-surface border border-divider rounded shadow-md py-1 min-w-32 z-30"
                          align="end"
                        >
                          <DropdownMenu.Item asChild>
                            <Link
                              to={`/investments/${inv.id}`}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-fill cursor-pointer"
                            >
                              View detail
                            </Link>
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="my-1 border-t border-divider" />
                          <DropdownMenu.Item asChild>
                            <button
                              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-fill cursor-pointer text-negative w-full"
                              onClick={() => setDeleteTarget(inv)}
                            >
                              <Trash2 size={13} strokeWidth={1.5} />
                              Delete
                            </button>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Investment Modal */}
      <AddInvestmentModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={refetch} />

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete investment">
        <p className="text-sm text-muted mb-4">
          Delete <strong className="text-text">{deleteTarget?.name}</strong>? This will permanently remove all {' '}
          transaction history. This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Add Investment Modal ────────────────────────────────────────────────────

interface AddInvestmentModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function AddInvestmentModal({ open, onClose, onCreated }: AddInvestmentModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Mutual Funds');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createInvestment({ name: name.trim(), category });
      setName('');
      setCategory('Mutual Funds');
      onClose();
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setError(''); }} title="Add investment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nifty 50 Index Fund" />
          {error && <p className="field-error">{error}</p>}
        </div>
        <div>
          <label className="label">Category</label>
          <select className="select" value={category} onChange={e => setCategory(e.target.value as Category)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Add investment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

