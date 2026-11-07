import { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Clock, MessageSquare, Target, Settings, Trophy, ChevronRight, GraduationCap, CheckCircle2, Sparkles, UserCircle, Languages, BookMarked } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAchievements } from '../hooks/useAchievements';
import { cn } from '../lib/utils';

interface DashboardProps {
  user: any;
}

export function Dashboard({ user }: DashboardProps) {
  const [profile, setProfile] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [weakSpots, setWeakSpots] = useState<any[]>([]);
  const [facts, setFacts] = useState<any[]>([]);
  const [vocabulary, setVocabulary] = useState<any[]>([]);
  const [trainingLogs, setTrainingLogs] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editLevel, setEditLevel] = useState('');
  const [editGoal, setEditGoal] = useState(15);
  
  useAchievements();

  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProfile(data);
        setEditLevel(data.learningLevel);
        setEditGoal(data.dailyGoalMinutes);
      } else if (user.uid.startsWith('guest_') || user.uid.startsWith('offline_')) {
        const defaultProfile = {
          email: user.email || '',
          displayName: user.displayName,
          learningLevel: 'beginner',
          streakDays: 0,
          totalPracticeMinutes: 0,
          dailyGoalMinutes: 15,
          createdAt: serverTimestamp()
        };
        setDoc(docRef, defaultProfile);
        setProfile(defaultProfile);
        setEditLevel('beginner');
        setEditGoal(15);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}`));

    const achRef = collection(db, 'users', user.uid, 'achievements');
    const unsubscribeAch = onSnapshot(query(achRef, orderBy('earnedAt', 'desc')), (snapshot) => {
      setAchievements(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/achievements`));

    const weakRef = collection(db, 'users', user.uid, 'weakSpots');
    const unsubscribeWeak = onSnapshot(query(weakRef, orderBy('createdAt', 'desc')), (snapshot) => {
      setWeakSpots(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/weakSpots`));

    const factsRef = collection(db, 'users', user.uid, 'facts');
    const unsubscribeFacts = onSnapshot(query(factsRef, orderBy('updatedAt', 'desc')), (snapshot) => {
      setFacts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/facts`));

    const vocabRef = collection(db, 'users', user.uid, 'vocabulary');
    const unsubscribeVocab = onSnapshot(query(vocabRef, orderBy('lastSeen', 'desc')), (snapshot) => {
      setVocabulary(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/vocabulary`));

    const logsRef = collection(db, 'users', user.uid, 'training_logs');
    const unsubscribeLogs = onSnapshot(logsRef, (snapshot) => {
      setTrainingLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/training_logs`));

    return () => {
      unsubscribeProfile();
      unsubscribeAch();
      unsubscribeWeak();
      unsubscribeFacts();
      unsubscribeVocab();
      unsubscribeLogs();
    };
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), {
      learningLevel: editLevel,
      dailyGoalMinutes: Number(editGoal)
    });
    setIsEditing(false);
  };

  if (!profile) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Initalizing Core...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans selection:bg-purple-500/30 pt-20 md:pt-32 pb-32">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
          <div>
            <div className="flex items-center gap-2 text-purple-500 mb-2">
              <GraduationCap size={16} className="md:w-5 md:h-5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Pilot Program</span>
            </div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-extrabold text-white tracking-tight"
            >
              System Dashboard
            </motion.h1>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center self-start md:self-auto gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-xs font-bold uppercase tracking-widest hover:border-purple-500/50 transition-colors"
          >
            <Settings size={14} />
            {isEditing ? "Close" : "Configure"}
          </button>
        </header>

        {/* Action Panel (Conditional) */}
        <AnimatePresence>
          {isEditing && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-12"
            >
              <div className="p-8 bg-gray-900 border border-gray-800 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Skill Level</label>
                  <select 
                    value={editLevel} 
                    onChange={e => setEditLevel(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Daily Goal (Minutes)</label>
                  <input 
                    type="number" 
                    value={editGoal}
                    onChange={e => setEditGoal(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none"
                  />
                </div>
                <button 
                  onClick={handleUpdateProfile}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-[46px] rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <StatPanel 
            icon={<Flame className="text-orange-500" />}
            label="Learning Streak"
            value={profile.streakDays}
            sub="Consecutive Days"
            color="orange"
          />
          <StatPanel 
            icon={<Clock className="text-blue-500" />}
            label="Total Vol."
            value={profile.totalPracticeMinutes}
            unit="M"
            sub="Practice Minutes"
            color="blue"
          />
          <StatPanel 
            icon={<Target className="text-emerald-500" />}
            label="Daily Quota"
            value={profile.dailyGoalMinutes}
            unit="M"
            sub="Target Goal"
            color="emerald"
          />
          <StatPanel 
            icon={<Trophy className="text-purple-500" />}
            label="Neural Training"
            value={trainingLogs.length}
            sub="Synapses Logged"
            color="purple"
          />
        </div>

        {/* Training Progress Block */}
        {trainingLogs.length > 0 && (
          <section className="mb-16 bg-purple-600/5 border border-purple-500/10 rounded-[2.5rem] p-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Sparkles className="text-purple-400" size={24} />
                <h3 className="text-xl font-bold text-white">Self-Training Loop</h3>
              </div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest animate-pulse">Model Optimizing...</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trainingLogs.slice(0, 4).map((log, i) => (
                <div key={i} className="p-4 bg-gray-900/50 border border-gray-800 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-mono text-gray-500 uppercase">Input: {log.user_input?.substring(0, 30)}...</span>
                    {log.is_quality_pair && <CheckCircle2 size={10} className="text-emerald-500" />}
                  </div>
                  <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, delay: i * 0.2 }}
                      className="h-full bg-purple-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 blur-[80px] -mr-32 -mt-32" />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-4">Current Progress</h3>
                <p className="text-gray-400 text-sm mb-8 max-w-md leading-relaxed">
                  You are currently operating at a <span className="text-purple-400 font-bold uppercase">{profile.learningLevel}</span> level. 
                  Your target is {profile.dailyGoalMinutes} minutes of active conversation per day.
                </p>
                <div className="flex flex-wrap gap-4 mb-10">
                  <div className="px-6 py-3 bg-gray-950 border border-gray-800 rounded-2xl flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono uppercase tracking-widest text-gray-300">Auth Status: Verified</span>
                  </div>
                  <div className="px-6 py-3 bg-gray-950 border border-gray-800 rounded-2xl flex items-center gap-3">
                    <span className="text-xs font-mono uppercase tracking-widest text-gray-300">Level: {profile.learningLevel}</span>
                  </div>
                </div>
                <Link 
                  to="/chat"
                  className="inline-flex items-center gap-3 bg-white text-black px-10 py-5 rounded-2xl font-black uppercase tracking-tighter hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_15px_40px_rgba(255,255,255,0.1)] group"
                >
                  Initiate Practice
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </section>

            <section className="bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">Targeted Training</h3>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Active Analysis</span>
              </div>
              <div className="space-y-4">
                {weakSpots.slice(0, 3).map((spot, i) => (
                  <div key={i} className="p-5 bg-gray-950 border border-gray-800 rounded-3xl group hover:border-purple-500/30 transition-colors">
                     <div className="flex items-center gap-3 mb-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{spot.type}</p>
                     </div>
                     <p className="text-sm text-gray-400 mb-2 italic">"{spot.original}"</p>
                     <div className="flex items-center gap-2 text-white font-medium text-sm">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        {spot.correction}
                     </div>
                  </div>
                ))}
                {weakSpots.length === 0 && (
                  <div className="py-12 text-center border-2 border-dashed border-gray-800 rounded-3xl">
                    <Sparkles className="mx-auto mb-4 text-gray-700" size={32} />
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">No weak spots detected. Perfect!</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-8">
            <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] p-8">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">User Context</h4>
              <div className="flex items-center gap-4 mb-8">
                <img 
                  src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-3xl border-2 border-gray-800"
                />
                <div>
                  <p className="font-bold text-white mb-1 truncate max-w-[120px]">{user?.displayName}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{user?.uid.substring(0, 8)}...</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gray-950 border border-gray-800 rounded-2xl">
                  <p className="text-[9px] font-bold text-gray-600 uppercase mb-2">Primary Goal</p>
                  <p className="text-xs text-gray-300">Conversational Fluency</p>
                </div>
                <div className="p-4 bg-gray-950 border border-gray-800 rounded-2xl">
                  <p className="text-[9px] font-bold text-gray-600 uppercase mb-2">Preferred Tone</p>
                  <p className="text-xs text-gray-300">Motivational & Friendly</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-600/10 border border-purple-500/20 rounded-[2.5rem] p-8 text-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-purple-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
               <div className="relative z-10">
                 <div className="w-16 h-16 bg-purple-600 rounded-3xl mx-auto mb-6 flex items-center justify-center text-white text-2xl shadow-2xl shadow-purple-600/20">
                   🧠
                 </div>
                 <p className="text-white font-bold mb-2">Neural Reflection</p>
                 <p className="text-xs text-gray-400 leading-relaxed italic mb-4">
                   {profile.neuralReflection || "Connecting to your cognitive patterns... Practice more to generate a reflection."}
                 </p>
                 <div className="flex items-center justify-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-purple-500 animate-ping" />
                    <span className="text-[8px] font-bold text-purple-500 uppercase tracking-widest">Active Insight Engine</span>
                 </div>
               </div>
            </div>
          </aside>

        </div>
        {/* Vocabulary & Context */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
           <section className="bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Languages className="text-purple-500" size={24} />
                  <h3 className="text-xl font-bold text-white">Lexicon Vault</h3>
                </div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Mastered: {vocabulary.length}</span>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {vocabulary.map((v: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-950 border border-gray-800 rounded-2xl group hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-white uppercase tracking-wider">{v.word}</span>
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[8px] font-bold uppercase rounded-md">{v.pos}</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{v.definition}</p>
                  </div>
                ))}
                {vocabulary.length === 0 && (
                  <div className="py-12 text-center border border-dashed border-gray-800 rounded-2xl">
                     <p className="text-xs text-gray-600 uppercase font-bold tracking-widest">No words recorded in lexicon yet</p>
                  </div>
                )}
              </div>
           </section>

           <section className="bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <UserCircle className="text-purple-500" size={24} />
                  <h3 className="text-xl font-bold text-white">Neural Synapses</h3>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Permanent Store</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {facts.map((fact: any, i: number) => (
                  <div key={i} className="px-5 py-3 bg-gray-950 border border-gray-800 rounded-2xl flex items-center gap-3 group hover:border-purple-500/30 transition-all">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                    <span className="text-xs text-gray-400 font-medium">{fact.content}</span>
                  </div>
                ))}
                {facts.length === 0 && (
                  <div className="w-full py-8 text-center border border-dashed border-gray-800 rounded-2xl">
                     <p className="text-xs text-gray-600 uppercase font-bold tracking-widest">Awaiting interaction to build neural profile</p>
                  </div>
                )}
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}

function StatPanel({ icon, label, value, unit, sub, color }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-gray-900 border border-gray-800 rounded-[2rem] p-8 group relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/5 blur-3xl -mr-12 -mt-12`} />
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-[#050505] border border-gray-800 rounded-2xl group-hover:border-gray-700 transition-colors">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-extrabold text-white tracking-tighter">{value}</span>
        {unit && <span className="text-lg font-bold text-gray-600 tracking-tighter">{unit}</span>}
      </div>
      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tight">{sub}</p>
    </motion.div>
  );
}

