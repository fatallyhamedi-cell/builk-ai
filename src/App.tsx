import { useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Chat } from './components/Chat';
import { Navbar } from './components/Navbar';
import { motion, AnimatePresence } from 'motion/react';
import { CloudOff, Wifi } from 'lucide-react';
import { getSession } from './lib/offline-auth';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [showOnlineSuccess, setShowOnlineSuccess] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineSuccess(true);
      setTimeout(() => setShowOnlineSuccess(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineSuccess(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 1. Check for Offline/Guest Session first
    const offlineSession = getSession();
    if (offlineSession) {
      setUser(offlineSession);
      setLoading(false);
      // We don't return here because we still want to listen to Firebase Auth 
      // in case the user was previously logged in via Google and our local session is stale.
      // But if we have an offline session, we prioritize it for immediate UI feedback.
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        try {
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: u.email,
              displayName: u.displayName,
              photoURL: u.photoURL,
              learningLevel: 'beginner',
              streakDays: 0,
              totalPracticeMinutes: 0,
              dailyGoalMinutes: 15,
              lastPracticeDate: null,
              createdAt: serverTimestamp()
            });
          }
        } catch (error: any) {
          const errMsg = error?.message?.toLowerCase() || '';
          const errCode = error?.code || '';
          const isOfflineOrUnavailable = errMsg.includes('offline') || 
                                         errMsg.includes('network') || 
                                         errMsg.includes('unavailable') || 
                                         errCode === 'unavailable' || 
                                         errCode === 'failed-precondition';
          if (isOfflineOrUnavailable) {
             console.warn("Firestore is offline or unavailable, proceeding with cached/limited state.");
          } else {
            handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          }
        }
        setUser(u);
      } else if (!offlineSession) {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 font-sans selection:bg-purple-600/30">
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              key="offline"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-600 text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 py-1 fixed top-0 left-0 right-0 z-[100] shadow-lg shadow-amber-900/40"
            >
              <CloudOff size={12} strokeWidth={3} />
              <span>Bulk AI Offline - Limited Functionality</span>
            </motion.div>
          )}
          
          {showOnlineSuccess && (
            <motion.div
              key="online"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 py-1 fixed top-0 left-0 right-0 z-[100]"
            >
              <Wifi size={12} strokeWidth={3} />
              <span>Back Online - Neural Link Restored</span>
            </motion.div>
          )}
        </AnimatePresence>

        {!user ? (
          <Auth />
        ) : (
          <>
            <Navbar user={user} />
            <Routes>
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/chat" element={<Chat user={user} />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </>
        )}
      </div>
    </BrowserRouter>
  );
}
