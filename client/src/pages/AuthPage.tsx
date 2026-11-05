import { useState } from 'react';
import { KeyRound, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const { signInWithGoogle, signInWithMasterKey, isConfigured } = useAuth();
  const [masterKey, setMasterKey] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoadingGoogle(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMsg(error.message || 'Google sign-in could not be initiated.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in failed.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleMasterKeySignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const success = signInWithMasterKey(masterKey.trim());
    if (success) {
      onLoginSuccess?.();
    } else {
      setErrorMsg('Invalid Master Key. Please check the key in your .env or settings.');
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

          {/* Option 1: Direct Google Login */}
          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loadingGoogle || !isConfigured}
              className="w-full flex items-center justify-center gap-2.5 py-2 px-3 border border-divider rounded bg-surface hover:bg-fill transition-colors text-xs font-medium text-text disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loadingGoogle ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-divider" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-surface px-2 text-muted">or use master key</span>
            </div>
          </div>

          {/* Option 2: Master Key Direct Login */}
          <form onSubmit={handleMasterKeySignIn} className="space-y-3">
            <div>
              <label className="label">Master Access Key</label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-2.5 top-2.5 text-muted pointer-events-none" />
                <input
                  type="password"
                  required
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  className="input pl-8 text-xs font-mono"
                  placeholder="Enter your master key..."
                />
              </div>
              <p className="text-[11px] text-muted mt-1">
                Default: <code className="text-text">admin123</code> (set <code className="text-text">VITE_MASTER_KEY</code> in .env)
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full justify-center py-2 text-xs"
            >
              <span>Unlock Portfolio</span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
