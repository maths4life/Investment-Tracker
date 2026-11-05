import { useState } from 'react';
import { KeyRound, Mail, Lock, ShieldCheck, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const { signInWithPasskey, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handlePasskeySignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      const { error } = await signInWithPasskey();
      if (error) {
        setErrorMsg(error.message || 'Passkey sign-in failed. Please try with password.');
      } else {
        onLoginSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Passkey authentication could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          onLoginSuccess?.();
        } else {
          setInfoMsg('Account created! Check your email to confirm your account or sign in directly.');
          setIsSignUp(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLoginSuccess?.();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
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
          <h1 className="text-xl font-medium text-text">
            {isSignUp ? 'Create your portfolio account' : 'Sign in to Investment Tracker'}
          </h1>
          <p className="text-xs text-muted">
            Secure, editorial personal finance tracking
          </p>
        </div>

        {/* Demo / Unconfigured Banner */}
        {!isConfigured && (
          <div className="p-3 bg-fill border border-divider rounded text-xs space-y-1 text-muted">
            <p className="font-medium text-text flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#6B8CAE]" /> Supabase credentials not set
            </p>
            <p className="leading-relaxed">
              Add your <code className="text-text">VITE_SUPABASE_URL</code> and <code className="text-text">VITE_SUPABASE_ANON_KEY</code> to your environment file to connect real users & biometric passkeys.
            </p>
          </div>
        )}

        {/* Card */}
        <div className="bg-surface border border-divider rounded-md p-6 shadow-sm space-y-5">
          {errorMsg && (
            <div className="p-3 bg-[#fdf2f1] border border-[#f5c7c2] rounded text-xs text-negative flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="p-3 bg-[#edf5f1] border border-[#c6e4d4] rounded text-xs text-positive flex items-start gap-2">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Passkey Fast Action */}
          {!isSignUp && (
            <div>
              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={loading || !isConfigured}
                className="btn btn-primary w-full justify-center py-2 text-xs"
              >
                <KeyRound size={14} strokeWidth={1.5} />
                Sign in with Passkey / Biometrics
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-divider" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-surface px-2 text-muted">or use email</span>
                </div>
              </div>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-2.5 top-2.5 text-muted pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-8 text-xs"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-2.5 top-2.5 text-muted pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-8 text-xs"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isConfigured}
              className={`btn w-full justify-center py-2 text-xs ${isSignUp ? 'btn-primary' : ''}`}
            >
              <span>{loading ? 'Processing...' : isSignUp ? 'Create account' : 'Sign in'}</span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          </form>

          {/* Switcher */}
          <div className="pt-2 text-center text-xs text-muted border-t border-divider">
            {isSignUp ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(false); setErrorMsg(null); }}
                  className="text-text font-medium hover:underline"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsSignUp(true); setErrorMsg(null); }}
                  className="text-text font-medium hover:underline"
                >
                  Create one
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

