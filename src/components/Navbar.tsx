import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { LogOut, User as UserIcon, MessageSquare, LayoutDashboard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { clearSession } from '../lib/offline-auth';

interface NavbarProps {
  user: any;
}

export function Navbar({ user }: NavbarProps) {
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    clearSession();
    window.location.href = '/'; // Simple way to reset state
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2 text-white font-black text-xl md:text-2xl tracking-tighter uppercase">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-600 rounded-xl flex items-center justify-center text-lg md:text-xl shadow-lg shadow-purple-600/20">
              🗣️
            </div>
            <span>Bulk <span className="text-purple-500">AI</span></span>
          </Link>

          <div className="hidden md:flex items-center gap-10">
            <Link 
              to="/dashboard" 
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${isActive('/dashboard') ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`}
            >
              <LayoutDashboard size={14} />
              Dashboard
            </Link>
            <Link 
              to="/chat" 
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${isActive('/chat') ? 'text-purple-400' : 'text-gray-400 hover:text-white'}`}
            >
              <MessageSquare size={14} />
              Chat
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 md:gap-4">
                <div className="hidden sm:block text-right">
                  <p className="text-[10px] font-bold text-white uppercase tracking-wider">{user.displayName?.split(' ')[0]}</p>
                  <p className="text-[8px] text-gray-500 font-mono">{user.uid.startsWith('offline_') || user.uid.startsWith('guest_') ? 'Offline Node' : 'Verified Pilot'}</p>
                </div>
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}`} 
                  alt="Avatar" 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl border-2 border-gray-800" 
                />
                <button 
                  onClick={handleLogout}
                  className="p-2 md:p-3 bg-gray-900 border border-gray-800 rounded-xl md:rounded-2xl text-gray-500 hover:text-rose-500 hover:border-rose-500/50 transition-all active:scale-90"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-2xl border-t border-gray-800/50 px-6 py-4">
        <div className="flex items-center justify-around">
          <Link 
            to="/dashboard" 
            className={`flex flex-col items-center gap-1 transition-all ${isActive('/dashboard') ? 'text-purple-500 scale-110' : 'text-gray-500'}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[8px] font-bold uppercase tracking-widest">Dash</span>
          </Link>
          <div className="w-12 h-12 bg-purple-600 rounded-full -mt-10 border-4 border-[#050505] flex items-center justify-center text-white shadow-2xl shadow-purple-600/40 active:scale-90 transition-transform">
             <Link to="/chat"><MessageSquare size={20} /></Link>
          </div>
          <button 
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 text-gray-500 active:text-rose-500"
          >
            <LogOut size={20} />
            <span className="text-[8px] font-bold uppercase tracking-widest">Exit</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

