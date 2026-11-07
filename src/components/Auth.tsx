import { useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Loader2, UserPlus, LogIn, UserCircle, ArrowLeft, Ghost } from 'lucide-react';
import { signupOffline, loginOffline, startGuestSession, saveSession } from '../lib/offline-auth';

type AuthView = 'initial' | 'login' | 'signup';

export function Auth() {
  const [view, setView] = useState<AuthView>('initial');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login failed:", err);
      setError('Google Auth failed. Please try offline mode or check your connection.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleOfflineSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating || !username || !password) return;
    setIsAuthenticating(true);
    setError(null);
    const result = await signupOffline(username, password);
    if (result.success) {
      setSuccess('Neural account created! Please login.');
      setView('login');
      setPassword('');
    } else {
      setError(result.error || 'Signup failed');
    }
    setIsAuthenticating(false);
  };

  const handleOfflineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating || !username || !password) return;
    setIsAuthenticating(true);
    setError(null);
    const result = await loginOffline(username, password);
    if (result.success && result.user) {
      saveSession(result.user);
      window.location.reload(); // Force App.tsx to pick up session
    } else {
      setError(result.error || 'Login failed');
    }
    setIsAuthenticating(false);
  };

  const handleGuestMode = () => {
    const session = startGuestSession();
    saveSession(session);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-purple-600/5 blur-3xl" />
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-purple-600 text-white mb-8 shadow-xl shadow-purple-600/20">
            <GraduationCap size={32} />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tighter uppercase">Bulk <span className="text-purple-500">AI</span></h1>
          
          <AnimatePresence mode="wait">
            {view === 'initial' && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <p className="text-gray-400 mb-10 text-sm leading-relaxed">
                  Master English through natural, low‑pressure conversation.
                </p>

                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-[10px] font-bold uppercase tracking-widest">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGoogleLogin}
                  disabled={isAuthenticating}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-gray-100 disabled:bg-gray-800 disabled:text-gray-600 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all active:scale-95 shadow-xl shadow-white/5"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                  Continue Online
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setView('login')}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-bold uppercase tracking-widest text-[9px] rounded-2xl transition-all"
                  >
                    <LogIn size={14} />
                    Login
                  </button>
                  <button
                    onClick={() => setView('signup')}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-bold uppercase tracking-widest text-[9px] rounded-2xl transition-all"
                  >
                    <UserPlus size={14} />
                    Signup
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleGuestMode}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-800 hover:bg-gray-800/50 text-gray-400 font-bold uppercase tracking-widest text-[9px] rounded-2xl transition-all"
                  >
                    <Ghost size={14} />
                    Continue as Guest
                  </button>
                </div>
              </motion.div>
            )}

            {(view === 'login' || view === 'signup') && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <button 
                  onClick={() => setView('initial')}
                  className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors mb-4"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>

                <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                  {view === 'login' ? 'Neural Login' : 'Create Identity'}
                </h2>

                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-[10px] font-bold uppercase tracking-widest">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                    {success}
                  </div>
                )}

                <form onSubmit={view === 'login' ? handleOfflineLogin : handleOfflineSignup} className="space-y-3">
                  <div className="relative">
                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                    <input 
                      type="text"
                      placeholder="Neural ID (Username)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-black border border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-white text-sm focus:border-purple-500 outline-none transition-all"
                    />
                  </div>
                  <input 
                    type="password"
                    placeholder="Security Key (Password)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded-2xl py-3 px-4 text-white text-sm focus:border-purple-500 outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all shadow-lg shadow-purple-600/20"
                  >
                    {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (view === 'login' ? 'Connect →' : 'Initialize Identity →')}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-12 flex flex-col items-center gap-2">
            <p className="text-[8px] text-gray-600 font-bold uppercase tracking-[0.3em]">
              Neural Engineering by
            </p>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
              Alexis Uwishatse
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

