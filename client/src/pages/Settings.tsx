import { useState, useEffect } from 'react';
import { Download, Upload, Info, Check, AlertCircle, Trash2, ShieldAlert, LogOut } from 'lucide-react';
import { getSettings, updateSettings, exportJSON, exportCSV, importJSON, deleteAccount } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { CATEGORIES } from '../types';
import type { Settings as SettingsType } from '../types';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user, signOut, currentProfile, removeProfile } = useAuth();
  const { data: settings, loading, refetch } = useApi<SettingsType>(getSettings);

  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savingAlloc, setSavingAlloc] = useState(false);

  // Account deletion state
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Dismissible notice state
  const [noticeDismissed, setNoticeDismissed] = useState(true);

  // Import state
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.target_allocation) {
        try {
          const parsed = JSON.parse(settings.target_allocation);
          setAllocations(parsed);
        } catch {
          setAllocations({});
        }
      }
      setNoticeDismissed(settings.first_run_dismissed === 'true');
    }
  }, [settings]);

  const handleDismissNotice = async () => {
    setNoticeDismissed(true);
    await updateSettings({ first_run_dismissed: 'true' });
    refetch();
  };

  const handleAllocationChange = (cat: string, val: string) => {
    const num = parseFloat(val) || 0;
    setAllocations(prev => ({
      ...prev,
      [cat]: num,
    }));
    setSaveSuccess(false);
  };

  const totalTargetPct = Object.values(allocations).reduce((acc, curr) => acc + (curr || 0), 0);

  const handleSaveAllocations = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAlloc(true);
    try {
      await updateSettings({
        target_allocation: JSON.stringify(allocations),
      });
      setSaveSuccess(true);
      refetch();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingAlloc(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        if (!parsed || !parsed.investments || !parsed.transactions) {
          setImportError('Invalid backup file: Missing required investments or transactions keys.');
          return;
        }
        setImportFileContent(content);
        setImportFileName(file.name);
        setImportConfirmOpen(true);
      } catch {
        setImportError('Failed to parse file: Selected file is not valid JSON.');
      }
    };
    reader.readAsText(file);
    // Reset file input value so user can pick the same file again if desired
    e.target.value = '';
  };

  const executeImport = async () => {
    if (!importFileContent) return;
    setImporting(true);
    setImportError(null);
    try {
      const parsed = JSON.parse(importFileContent);
      const res = await importJSON(parsed);
      setImportConfirmOpen(false);
      setImportFileContent(null);
      setImportSuccess(`Import completed successfully: Restored ${res.invested} investments and ${res.transactions} transactions.`);
      refetch();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setImportConfirmOpen(false);
    } finally {
      setImporting(false);
    }
  };

  if (loading && !settings) {
    return <div className="text-muted text-sm">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 pb-16 md:pb-0 max-w-2xl">
      <div>
        <h1 className="section-heading text-[16px] mb-1">Settings</h1>
        <p className="text-xs text-muted">Manage target allocations, database backup, and restore.</p>
      </div>

      {/* Dismissible Notice */}
      {!noticeDismissed && (
        <div className="flex items-start justify-between gap-3 p-3.5 bg-fill border border-divider rounded">
          <div className="flex items-start gap-2.5">
            <Info size={16} strokeWidth={1.5} className="text-muted shrink-0 mt-0.5" />
            <div className="text-xs text-text leading-relaxed">
              <p className="font-medium mb-0.5">Local SQLite Database Storage</p>
              <p className="text-muted">
                Your portfolio data is stored exclusively in a local database file on your system (<code className="text-text">server/data/app.db</code>).
                Because it is not synced to a remote cloud, export backups regularly to avoid data loss.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismissNotice}
            className="text-xs text-muted hover:text-text px-2 py-0.5 hover:bg-surface rounded border border-transparent hover:border-divider shrink-0 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Account Info & Sign Out / Delete Account */}
      {user && (
        <section className="space-y-4">
          <div className="border-b border-divider pb-2 flex items-center justify-between">
            <div>
              <h2 className="section-heading">Active Account</h2>
              <p className="text-xs text-muted mt-0.5">
                Current profile: <strong className="text-text font-medium">{currentProfile}</strong> ({user.email})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => signOut()}
                className="btn text-xs py-1"
              >
                <LogOut size={13} strokeWidth={1.5} />
                Sign out
              </button>
              <button
                onClick={() => setDeleteAccountModalOpen(true)}
                className="btn btn-danger text-xs py-1"
                title="Permanently delete this account profile"
              >
                <Trash2 size={13} strokeWidth={1.5} />
                Delete Account
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Target Allocations Form */}
      <section className="space-y-4">
        <div className="border-b border-divider pb-2">
          <h2 className="section-heading">Target Allocation</h2>
          <p className="text-xs text-muted mt-0.5">
            Set your desired portfolio allocation percentages by asset category.
          </p>
        </div>

        <form onSubmit={handleSaveAllocations} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORIES.map(category => (
              <div key={category} className="flex items-center justify-between gap-2 p-2.5 border border-divider rounded bg-surface">
                <span className="text-xs font-medium text-text">{category}</span>
                <div className="flex items-center gap-1.5 w-24">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={allocations[category] ?? ''}
                    onChange={(e) => handleAllocationChange(category, e.target.value)}
                    className="input py-1 px-2 text-right text-xs"
                    placeholder="0"
                  />
                  <span className="text-xs text-muted">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs">
              <span className="text-muted">Total allocated: </span>
              <span className={`font-medium tabular-nums ${totalTargetPct === 100 ? 'text-positive' : totalTargetPct > 100 ? 'text-negative' : 'text-text'}`}>
                {totalTargetPct}%
              </span>
              {totalTargetPct !== 100 && (
                <span className="text-muted ml-1.5">
                  ({totalTargetPct < 100 ? `${(100 - totalTargetPct).toFixed(1)}% unassigned` : `${(totalTargetPct - 100).toFixed(1)}% over 100%`})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="inline-flex items-center gap-1 text-xs text-positive">
                  <Check size={14} strokeWidth={2} /> Saved
                </span>
              )}
              <button
                type="submit"
                disabled={savingAlloc}
                className="btn btn-primary"
              >
                {savingAlloc ? 'Saving...' : 'Save targets'}
              </button>
            </div>
          </div>
        </form>
      </section>

      <div className="border-t border-divider" />

      {/* Data Backup & Restore */}
      <section className="space-y-4">
        <div className="border-b border-divider pb-2">
          <h2 className="section-heading">Data Backup & Restore</h2>
          <p className="text-xs text-muted mt-0.5">
            Export a full JSON backup, download transactions in CSV format, or restore from a previous JSON file.
          </p>
        </div>

        {importSuccess && (
          <div className="p-3 bg-[#edf5f1] border border-[#c6e4d4] text-positive text-xs rounded flex items-center gap-2">
            <Check size={14} strokeWidth={2} className="shrink-0" />
            <span>{importSuccess}</span>
          </div>
        )}

        {importError && (
          <div className="p-3 bg-[#fdf2f1] border border-[#f5c7c2] text-negative text-xs rounded flex items-center gap-2">
            <AlertCircle size={14} strokeWidth={1.5} className="shrink-0" />
            <span>{importError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Export JSON */}
          <div className="p-4 border border-divider rounded bg-surface flex flex-col justify-between space-y-3">
            <div>
              <p className="text-xs font-medium text-text mb-1">JSON Backup</p>
              <p className="text-xs text-muted leading-relaxed">
                Complete database export including investments, all transactions, holdings, and settings.
              </p>
            </div>
            <button
              onClick={exportJSON}
              className="btn w-full justify-center text-xs"
            >
              <Download size={13} strokeWidth={1.5} />
              Export JSON
            </button>
          </div>

          {/* Export CSV */}
          <div className="p-4 border border-divider rounded bg-surface flex flex-col justify-between space-y-3">
            <div>
              <p className="text-xs font-medium text-text mb-1">CSV Transactions</p>
              <p className="text-xs text-muted leading-relaxed">
                Spreadsheet-friendly export of all transaction records with calculated rupee amounts.
              </p>
            </div>
            <button
              onClick={exportCSV}
              className="btn w-full justify-center text-xs"
            >
              <Download size={13} strokeWidth={1.5} />
              Export CSV
            </button>
          </div>

          {/* Import JSON */}
          <div className="p-4 border border-divider rounded bg-surface flex flex-col justify-between space-y-3">
            <div>
              <p className="text-xs font-medium text-text mb-1">Restore Database</p>
              <p className="text-xs text-muted leading-relaxed">
                Replace current database records with a valid backup file.
              </p>
            </div>
            <label className="btn w-full justify-center text-xs cursor-pointer text-center">
              <Upload size={13} strokeWidth={1.5} />
              Import JSON
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Confirmation Modal for Import */}
      <Modal
        open={importConfirmOpen}
        onClose={() => { setImportConfirmOpen(false); setImportFileContent(null); }}
        title="Confirm Database Replace"
      >
        <div className="space-y-4">
          <p className="text-sm text-text leading-relaxed">
            Are you sure you want to restore data from <strong className="font-semibold">{importFileName}</strong>?
          </p>
          <div className="p-3 bg-[#fdf2f1] border border-[#f5c7c2] rounded text-xs text-negative leading-relaxed">
            <strong>Warning:</strong> This action will permanently delete all current investments, transactions, and settings in your local database and replace them with the backup data.
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              className="btn"
              onClick={() => { setImportConfirmOpen(false); setImportFileContent(null); }}
              disabled={importing}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={executeImport}
              disabled={importing}
            >
              {importing ? 'Restoring...' : 'Replace All Data'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal for Delete Account */}
      <Modal
        open={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        title="Delete Account Profile"
      >
        <div className="space-y-4">
          <p className="text-sm text-text leading-relaxed">
            Are you sure you want to permanently delete the <strong className="font-semibold">{currentProfile}</strong> account?
          </p>
          <div className="p-3 bg-[#fdf2f1] border border-[#f5c7c2] rounded text-xs text-negative leading-relaxed">
            <strong>Permanent Action:</strong> All investments, transactions, and settings belonging to <strong>{currentProfile}</strong> will be permanently wiped from the database.
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              className="btn"
              onClick={() => setDeleteAccountModalOpen(false)}
              disabled={deletingAccount}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              disabled={deletingAccount}
              onClick={async () => {
                setDeletingAccount(true);
                try {
                  await deleteAccount();
                  removeProfile(currentProfile);
                  await signOut();
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to delete account');
                  setDeletingAccount(false);
                }
              }}
            >
              {deletingAccount ? 'Deleting...' : 'Delete Account Permanently'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

