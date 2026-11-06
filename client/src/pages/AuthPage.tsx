import { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, ArrowRight, AlertCircle, Plus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const { signInWithPassword, addProfile, profiles } = useAuth();
  const [selectedProfile, setSelectedProfile] = useState<string>(profiles[0]?.id || 'Personal');
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profiles.length > 0 && (!selectedProfile || !profiles.some(p => p.id === selectedProfile))) {
      setSelectedProfile(profiles[0].id);
    }
  }, [profiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isAddingProfile) {
      const cleanName = newProfileName.trim();
      if (!cleanName) {
        setErrorMsg('Please specify a username / account name.');
        return;
      }

      await addProfile(cleanName, password);
      onLoginSuccess?.();
      return;
    } else {
      if (!selectedProfile) {
        setErrorMsg('Please select an account.');
        return;
      }

      const success = signInWithPassword(selectedProfile, password);
      if (success) {
        onLoginSuccess?.();
      } else {
        setErrorMsg('Incorrect password for this account. (Default for initial accounts is admin123).');
      }
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-1">
          <div className="inline-flex p-2.5 rounded-md bg-fill text-text mb-2 border border-divider">
            <ShieldCheck size={22} strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-medium text-text">Investment Tracker</h1>
          <p className="text-xs text-muted">
            Quiet, editorial personal finance tracking
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-divider rounded-md p-6 shadow-sm space-y-5">
          {errorMsg && (
            <div className="p-3 bg-[#fdf2f1] border border-[#f5c7c2] rounded text-xs text-negative flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Account Profile Switcher + Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">
                  {isAddingProfile ? 'Create New Account' : 'Select Account Profile'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProfile(!isAddingProfile);
                    setErrorMsg(null);
                    setPassword('');
                  }}
                  className="text-[11px] text-[#6B8CAE] hover:underline flex items-center gap-0.5"
                >
                  <Plus size={12} />
                  {isAddingProfile ? 'Choose existing' : 'New account'}
                </button>
              </div>

              {isAddingProfile ? (
                <div className="relative">
                  <Users size={14} className="absolute left-2.5 top-2.5 text-muted pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="input pl-8 text-xs"
                    placeholder="Username"
                  />
                </div>
              ) : (
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  className="select text-xs w-full py-2"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="label">
                {isAddingProfile ? 'Set Password' : 'Password'}
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-2.5 top-2.5 text-muted pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-8 text-xs font-mono"
                  placeholder={isAddingProfile ? 'Create any password (no limits)' : 'Enter password...'}
                />
              </div>
              <p className="text-[11px] text-muted mt-1">
                {isAddingProfile
                  ? 'No character or complexity limits.'
                  : 'Default for original accounts: admin123'}
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full justify-center py-2 text-xs"
            >
              <span>
                {isAddingProfile
                  ? `Create & Unlock ${newProfileName.trim() || 'Account'}`
                  : `Unlock ${selectedProfile}`}
              </span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
