import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  getDocs,
  doc, 
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Send, Volume2, VolumeX, RefreshCcw, Sparkles, Settings2, UserCircle, MessageCircle, Phone, X } from 'lucide-react';
import { useVoice } from '../hooks/useVoice';
import { sendMessageToBulkAI, analyzeExchange, getProactiveOpener, generateNeuralReflection } from '../lib/gemini';
import { INITIAL_ASSISTANT_MESSAGE, CHARACTERS } from '../lib/constants';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { AlertCircle, CheckCircle2, ChevronDown, Sliders, CloudOff } from 'lucide-react';

interface ChatProps {
  user: any;
}

export function Chat({ user }: ChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isReflecting, setIsReflecting] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [facts, setFacts] = useState<any[]>([]);
  const [reflection, setReflection] = useState<string | null>(null);
  const [isCallMode, setIsCallMode] = useState(false);
  const [coachingTip, setCoachingTip] = useState<any>(null);
  const [quotaWarning, setQuotaWarning] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [selectedCharId, setSelectedCharId] = useState(() => localStorage.getItem('bulk_char_id') || 'bulk_ai');
  const [voiceRate, setVoiceRate] = useState(() => Number(localStorage.getItem('bulk_voice_rate')) || 0.95);
  const [voicePitch, setVoicePitch] = useState(() => Number(localStorage.getItem('bulk_voice_pitch')) || 1.0);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isListening, isSpeaking, startListening, stopListening, speak, stopSpeaking, primeVoice } = useVoice();

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const groupMessagesByDate = (msgs: any[]) => {
    const groups: { [key: string]: any[] } = {};
    msgs.forEach(msg => {
      const date = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleDateString() : 'Today';
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  // Load Facts & Neural Reflection
  useEffect(() => {
    if (!user) return;
    const factsRef = collection(db, 'users', user.uid, 'facts');
    const unsubscribeFacts = onSnapshot(factsRef, (snapshot) => {
      const f = snapshot.docs.map(doc => doc.data().content);
      setFacts(f);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/facts`));

    const docRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setReflection(snapshot.data().neuralReflection || null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));

    return () => {
      unsubscribeFacts();
      unsubscribeProfile();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const convId = 'default_conversation';
    const messagesRef = collection(db, 'users', user.uid, 'conversations', convId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setMessages(msgs);
      
      if (msgs.length === 0) {
        getProactiveOpener(facts, user.displayName?.split(' ')[0] || 'friend').then(opener => {
          if (opener && opener.includes("SYSTEM ALERT")) {
            setQuotaWarning(true);
            return;
          }
          addDoc(messagesRef, {
            role: 'assistant',
            content: opener || INITIAL_ASSISTANT_MESSAGE,
            createdAt: serverTimestamp()
          }).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/conversations/${convId}/messages`));
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/conversations/${convId}/messages`));

    return () => unsubscribe();
  }, [user]);

  const selectedCharacter = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];

  // Auto-listen loop for Voice Mode
  useEffect(() => {
    let timer: any;
    if (isCallMode && !isListening && !isSpeaking && !isTyping && !quotaWarning) {
      // If there was a voice error, wait longer before retrying
      const delay = voiceError === 'network' ? 5000 : 1000;
      
      // Natural silence before AI engages listening again (Human-like wait)
      timer = setTimeout(() => {
        startVoiceInput();
      }, delay); 
    }
    return () => clearTimeout(timer);
  }, [isCallMode, isListening, isSpeaking, isTyping, quotaWarning, voiceError]);

  useEffect(() => {
    localStorage.setItem('bulk_char_id', selectedCharId);
  }, [selectedCharId]);

  useEffect(() => {
    localStorage.setItem('bulk_voice_rate', voiceRate.toString());
    localStorage.setItem('bulk_voice_pitch', voicePitch.toString());
  }, [voiceRate, voicePitch]);

  // Background Sync when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      if (!user || messages.length === 0) return;
      
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'user' && lastMsg.isQueued && !isTyping) {
        handleSendMessage(lastMsg.content);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, messages, isTyping]);

  const handleNeuralRestart = () => {
    setIsRestarting(true);
    setQuotaWarning(false);
    setIsTyping(false);
    setIsReflecting(false);
    setTimeout(() => setIsRestarting(false), 2000);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !user || isTyping) return;
    setQuotaWarning(false);

    const convId = 'default_conversation';
    const messagesRef = collection(db, 'users', user.uid, 'conversations', convId, 'messages');

    // 1. Add User Message (Firestore will handle local persistence)
    try {
      await addDoc(messagesRef, {
        role: 'user',
        content: text,
        createdAt: serverTimestamp(),
        isQueued: !navigator.onLine
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/conversations/${convId}/messages`);
    }

    setInputText('');
    
    // 2. If Offline, we still proceed to generate a Low-Power response
    // the sendMessageToBulkAI function handles the offline detection internally.
    try {
      setIsTyping(true);
      setIsReflecting(true);

      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        content: m.content
      }));
      
      const aiResponse = await sendMessageToBulkAI(
        text, 
        history, 
        facts, 
        selectedCharacter.prompt, 
        user.displayName || user.email?.split('@')[0]
      );
      setIsReflecting(false);

      if (aiResponse.includes("SYSTEM ALERT")) {
        setQuotaWarning(true);
      }

      await addDoc(messagesRef, {
        role: 'assistant',
        content: aiResponse,
        createdAt: serverTimestamp()
      });

      if (audioEnabled) {
        speak(aiResponse, { rate: voiceRate, pitch: voicePitch });
      }

      // Background Analysis (Works Offline too now!)
      setIsSynthesizing(true);
      analyzeExchange(text, aiResponse).then(async (analysis) => {
        if (!analysis) return;

        // 1. Handle Grammar
        if (analysis.grammar?.hasError) {
          setCoachingTip(analysis.grammar);
          addDoc(collection(db, 'users', user.uid, 'weakSpots'), {
            ...analysis.grammar,
            original: text,
            createdAt: serverTimestamp()
          });
        } else {
          setCoachingTip(null);
        }

        // 2. Handle Facts (Online Only for now due to LLM extraction)
        if (navigator.onLine) {
          const newFacts = analysis.facts || [];
          const uniqueNewFacts = newFacts.filter((f: string) => !facts.includes(f));
          if (uniqueNewFacts.length > 0) {
            const factsRef = collection(db, 'users', user.uid, 'facts');
            for (const fact of uniqueNewFacts) {
              await addDoc(factsRef, {
                content: fact,
                category: 'general',
                confidence: 0.9,
                updatedAt: serverTimestamp()
              });
            }

            // Generate reflection
            const newReflection = await generateNeuralReflection([...facts, ...uniqueNewFacts]);
            if (newReflection && !newReflection.includes("SYSTEM ALERT")) {
              await updateDoc(doc(db, 'users', user.uid), {
                neuralReflection: newReflection
              });
            }
          }
        }

        // 3. Handle Vocabulary
        const newWords = analysis.vocabulary || [];
        if (newWords.length > 0) {
          const vocabRef = collection(db, 'users', user.uid, 'vocabulary');
          for (const wordObj of newWords) {
            await addDoc(vocabRef, {
              ...wordObj,
              createdAt: serverTimestamp(),
              lastSeen: serverTimestamp(),
              mastery: 0.1
            });
          }
        }
      }).catch(err => console.warn("Analysis failed (likely offline/limit):", err))
        .finally(() => setIsSynthesizing(false));

      // 5. Log for Self-Training (Step 1 of blueprint)
      if (navigator.onLine) {
        addDoc(collection(db, 'users', user.uid, 'training_logs'), {
          timestamp: serverTimestamp(),
          user_input: text,
          ai_response: aiResponse,
          intent: "conversation",
          is_quality_pair: true,
          user_rating: null
        }).catch(err => console.warn("Training log failed:", err));
      }

    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsTyping(false);
      setIsReflecting(false);
    }
  };

  const startVoiceInput = () => {
    primeVoice(); // Prime audio on user gesture
    if (isListening) {
      stopListening();
    } else {
      setVoiceError(null);
      // If AI is currently speaking, we don't necessarily stop it yet.
      // We stop it when the user ACTUALLY starts speaking (detected by onspeechstart).
      startListening(
        (text) => {
          handleSendMessage(text);
        },
        () => {
          // Barge-in: User started speaking, stop the AI!
          if (isSpeaking) {
            stopSpeaking();
          }
        },
        (err) => {
          setVoiceError(err);
        }
      );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#050505] pt-16 overflow-hidden">
      {/* Neural Recall Indicator */}
      <AnimatePresence>
        {isCallMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-gray-950 flex flex-col items-center justify-center p-4 md:p-8 text-center"
          >
            <div className="absolute top-4 md:top-8 right-4 md:right-8">
              <button 
                onClick={() => setIsCallMode(false)}
                className="p-3 md:p-4 rounded-full bg-gray-900 border border-gray-800 text-gray-500 hover:text-white"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </button>
            </div>
            
            <div className="relative mb-8 md:mb-12">
              <div className="absolute inset-0 bg-purple-600/20 blur-[60px] md:blur-[100px] animate-pulse" />
              <motion.div 
                animate={{ 
                  scale: isListening ? [1, 1.1, 1] : 1,
                  rotate: isTyping ? [0, 5, -5, 0] : 0
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className={cn(
                  "w-32 h-32 md:w-48 md:h-48 rounded-full border-2 md:border-4 flex items-center justify-center relative z-10 transition-colors duration-500",
                  isListening ? "border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.3)]" : 
                  isTyping ? "border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)]" :
                  "border-white/10"
                )}
              >
                <div className="text-4xl md:text-6xl text-white drop-shadow-2xl">{selectedCharacter.avatar}</div>
                {/* Neural Pulse Orbits */}
                <AnimatePresence>
                  {(isListening || isTyping || isSpeaking) && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 1 }}
                      exit={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={cn(
                        "absolute inset-0 rounded-full border-2",
                        isListening ? "border-rose-500/30" : 
                        isTyping ? "border-purple-500/30" : 
                        "border-emerald-500/30"
                      )}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
              {isListening && (
                 <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-rose-500/20 rounded-full"
                 />
              )}
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase tracking-tighter">{selectedCharacter.name}</h2>
            <div className="flex items-center gap-3 mb-8 md:mb-12">
              <div className={cn(
                "w-2 md:w-2.5 h-2 md:h-2.5 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.6)]",
                isListening ? "bg-rose-500 animate-pulse" : 
                isTyping ? "bg-purple-500 animate-bounce" :
                isSpeaking ? "bg-emerald-500 shadow-emerald-500/50" : "bg-gray-700"
              )} />
              <p className="text-gray-400 font-mono text-[8px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.5em] font-bold">
                {isListening ? "Synchronizing Input" : 
                 isTyping ? "Analyzing Synapses" :
                 isSpeaking ? "Data Transmission" : "Link Standby"}
              </p>
            </div>

            <div className="flex gap-2 md:gap-4 mb-8 md:mb-12 max-w-sm flex-wrap justify-center px-4">
              {facts.slice(-2).map((fact, i) => (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={i} 
                  className="px-2 py-1 md:px-3 md:py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[8px] md:text-[9px] text-purple-400 font-mono truncate max-w-[150px]"
                >
                  Recall: {fact}
                </motion.span>
              ))}
            </div>
            
            <div className="flex gap-4 md:gap-8 items-center">
                <button 
                   onClick={() => {
                     primeVoice();
                     setAudioEnabled(!audioEnabled);
                   }}
                  className={cn(
                    "p-4 md:p-6 rounded-2xl md:rounded-[2rem] border transition-all",
                    audioEnabled ? "bg-purple-600/10 border-purple-500/30 text-purple-400" : "bg-gray-950 border-gray-800 text-gray-600"
                  )}
               >
                 {audioEnabled ? <Volume2 size={24} className="md:w-8 md:h-8" /> : <VolumeX size={24} className="md:w-8 md:h-8" />}
               </button>

               <button 
                  onClick={startVoiceInput}
                  className={cn(
                    "w-20 h-20 md:w-24 md:h-24 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center transition-all shadow-2xl",
                    isListening ? "bg-rose-600 text-white scale-110 shadow-rose-600/40" : "bg-white text-black hover:scale-105"
                  )}
               >
                 <Mic size={32} className="md:w-10 md:h-10" />
               </button>

               <button 
                onClick={() => {
                  setShowSettings(true);
                  setIsCallMode(false);
                }}
                className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-gray-800 text-gray-600 bg-gray-950"
              >
                 <Settings2 size={24} className="md:w-8 md:h-8" />
               </button>
            </div>

            <p className="mt-8 md:mt-12 text-gray-500 font-medium italic max-w-[200px] md:max-w-xs mx-auto text-sm">
              {isListening ? "Bulk AI is listening closely..." : "Click the mic to speak naturally"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-950/60 px-4 md:px-6 py-3 border-b border-gray-800/50 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-purple-500">
            <Sparkles size={12} />
            <span>AI Neural Sync</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-gray-800" />
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 group text-left"
          >
            <div className="w-8 h-8 rounded-lg md:rounded-full bg-gray-900 flex items-center justify-center text-base md:text-lg border border-gray-800 group-hover:border-purple-500/50 transition-colors">
              {selectedCharacter.avatar}
            </div>
            <div>
              <p className="text-[10px] font-bold text-white uppercase tracking-wider">{selectedCharacter.name}</p>
              <p className="text-[8px] text-gray-500 uppercase font-mono hidden md:block">Tutor Profile</p>
            </div>
            <ChevronDown size={12} className={cn("text-gray-500 transition-transform", showSettings && "rotate-180")} />
          </button>
        </div>

        {voiceError === 'network' && (
          <div className="flex-1 flex justify-center px-4">
            <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full flex items-center gap-2 text-[9px] font-bold text-amber-500 uppercase tracking-widest group relative">
              <AlertCircle size={12} />
              <span>Voice Recognition Offline</span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-gray-900 border border-gray-800 rounded-lg text-[8px] text-gray-400 normal-case font-medium opacity-0 group-hover:opacity-100 transition-opacity z-[70] pointer-events-none">
                Voice-to-text requires a connection in this browser. Text-chat is still fully functional offline!
              </div>
            </div>
          </div>
        )}

        {quotaWarning && (
          <div className="flex-1 flex justify-center px-4">
            <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 pl-5 rounded-full flex items-center gap-6 text-[9px] font-bold text-rose-500 uppercase tracking-widest">
              <div className="flex items-center gap-2 animate-pulse">
                <AlertCircle size={12} />
                <span>Neural Overload - Systems Cooling</span>
              </div>
              <button 
                onClick={handleNeuralRestart}
                className="bg-rose-500 text-white px-3 py-1 rounded-lg hover:bg-rose-400 transition-all active:scale-95 shadow-lg shadow-rose-600/20"
              >
                Neural Restart
              </button>
            </div>
          </div>
        )}

        {isRestarting && (
          <div className="flex-1 flex justify-center px-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full flex items-center gap-2 text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
              <CheckCircle2 size={12} />
              <span>Synapses Synchronized</span>
            </div>
          </div>
        )}

        {isSynthesizing && (
          <div className="flex-1 flex justify-center px-4">
            <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full flex items-center gap-2 text-[9px] font-bold text-purple-500 uppercase tracking-widest animate-pulse">
              <Sparkles size={12} />
              <span>Neural Synthesis Active</span>
            </div>
          </div>
        )}

        <button 
          onClick={() => {
            primeVoice();
            setIsCallMode(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-[0_10px_30px_rgba(147,51,234,0.3)] transition-all active:scale-95"
        >
          <Phone size={14} />
          Voice Call
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex">
        {/* Settings Overlay */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="absolute left-0 top-0 bottom-0 w-full sm:w-80 bg-gray-950/95 sm:bg-gray-900 border-r border-gray-800 p-6 md:p-8 z-40 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800/50">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                  <Sliders size={14} className="text-purple-500" />
                  Neural Systems
                </h3>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="p-2 bg-gray-900 rounded-lg text-gray-500 hover:text-white"
                >
                   <X size={16} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Select Persona</p>
                  <div className="grid grid-cols-1 gap-3">
                    {CHARACTERS.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCharId(c.id)}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                          selectedCharId === c.id 
                            ? "bg-purple-600/10 border-purple-500/30 text-white" 
                            : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700"
                        )}
                      >
                        <span className="text-xl">{c.avatar}</span>
                        <div>
                          <p className="text-xs font-bold">{c.name}</p>
                          <p className="text-[9px] text-gray-500">{c.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-800">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Voice Modulation</p>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] font-mono text-gray-400 uppercase">
                        <span>Speed</span>
                        <span>{voiceRate.toFixed(2)}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="1.5" step="0.05"
                        value={voiceRate}
                        onChange={(e) => setVoiceRate(Number(e.target.value))}
                        className="w-full accent-purple-500 h-1 bg-gray-800 rounded-lg appearance-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] font-mono text-gray-400 uppercase">
                        <span>Pitch</span>
                        <span>{voicePitch.toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="1.5" step="0.05"
                        value={voicePitch}
                        onChange={(e) => setVoicePitch(Number(e.target.value))}
                        className="w-full accent-purple-500 h-1 bg-gray-800 rounded-lg appearance-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages Window */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-hide">
          <div className="max-w-3xl mx-auto space-y-12 pb-32">
            <AnimatePresence initial={false}>
              {Object.entries(messageGroups).map(([date, msgs]) => (
                <div key={date} className="space-y-10">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-gray-800/50" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em] font-mono">{date}</span>
                    <div className="h-px flex-1 bg-gray-800/50" />
                  </div>
                  
                  {msgs.map((msg, idx) => (
                    <motion.div
                      key={msg.id || idx}
                      initial={{ opacity: 0, y: 15, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className={cn(
                        "flex items-start gap-4",
                        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300",
                        msg.role === 'user' 
                          ? "bg-purple-600/10 border-purple-500/20 text-purple-500 shadow-lg shadow-purple-600/5" 
                          : "bg-gray-900 border-gray-800 text-gray-400"
                      )}>
                        {msg.role === 'user' ? '👤' : selectedCharacter.avatar}
                      </div>
                      <div className="flex flex-col gap-1 max-w-[85%]">
                        <div className={cn(
                          "px-6 py-4 rounded-[2rem] text-base leading-relaxed tracking-wide shadow-2xl transition-all duration-500",
                          msg.role === 'user' 
                            ? "bg-purple-600 text-white rounded-tr-none shadow-purple-600/20" 
                            : "bg-gray-900 border border-gray-800 text-gray-200 rounded-tl-none border-t-purple-500/10"
                        )}>
                          <div className="prose prose-invert prose-p:my-1 prose-headings:my-2 prose-strong:text-purple-400 prose-blockquote:border-purple-500/30 prose-blockquote:bg-purple-500/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-xl">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[9px] font-mono text-gray-600 uppercase tracking-widest px-2 flex items-center gap-1",
                          msg.role === 'user' ? "justify-end text-right" : "justify-start text-left"
                        )}>
                          {msg.isQueued && msg.role === 'user' && <CloudOff size={8} className="text-amber-500 animate-pulse" />}
                          {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ))}
            </AnimatePresence>

          {coachingTip && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-gray-900 border-2 border-purple-500/20 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-600/10 transition-colors" />
              <div className="relative z-10 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/10 flex items-center justify-center text-purple-500 shrink-0 border border-purple-500/20">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Grammar Focus: {coachingTip.errorType}</span>
                  </div>
                  <p className="text-white font-bold mb-1">Try this instead:</p>
                  <p className="text-purple-300 italic mb-3 font-medium">"{coachingTip.correction}"</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{coachingTip.explanation}</p>
                </div>
              </div>
            </motion.div>
          )}
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-4"
            >
               <div className="w-10 h-10 rounded-2xl bg-gray-800/50 border border-gray-700/30 flex items-center justify-center text-gray-500">
                 {isReflecting ? <Sparkles size={16} className="text-purple-500 animate-pulse" /> : <RefreshCcw size={16} className="animate-spin" />}
               </div>
               <div className="bg-gray-900 border border-gray-800 px-5 py-4 rounded-3xl rounded-tl-none relative overflow-hidden">
                 <div className="flex gap-1 items-center">
                   <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                   <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                   <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" />
                   {isReflecting && (
                     <span className="ml-3 text-[8px] font-mono font-bold text-purple-400 uppercase tracking-widest animate-pulse">Neural Scan In Progress</span>
                   )}
                 </div>
               </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-4 md:p-6 bg-gray-950/60 backdrop-blur-2xl border-t border-gray-800/50 pb-24 md:pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 md:gap-4">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                primeVoice();
                setAudioEnabled(!audioEnabled);
              }}
              className={cn(
                "p-3 md:p-4 rounded-xl md:rounded-2xl transition-all border",
                audioEnabled 
                  ? "bg-purple-600/10 border-purple-500/20 text-purple-400" 
                  : "bg-gray-900 border-gray-800 text-gray-500"
              )}
            >
              {audioEnabled ? <Volume2 size={20} className="md:w-6 md:h-6" /> : <VolumeX size={20} className="md:w-6 md:h-6" />}
            </motion.button>

            <div className="relative flex-1 group">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                placeholder="Speak your mind..."
                className="w-full bg-gray-900/50 border border-gray-800 rounded-xl md:rounded-2xl px-4 md:px-6 py-4 md:py-5 text-sm md:text-base text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600/50 transition-all"
              />
              <button 
                onClick={() => handleSendMessage(inputText)}
                disabled={!inputText.trim() || isTyping}
                className="absolute right-2 md:right-3 top-2 md:top-3 bottom-2 md:top-3 px-4 md:px-5 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-purple-600 text-white rounded-lg md:rounded-xl transition-all font-bold flex items-center"
              >
                <Send size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
            </div>

            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startVoiceInput}
              className={cn(
                "p-4 md:p-5 rounded-xl md:rounded-2xl transition-all shadow-xl relative",
                isListening 
                  ? "bg-rose-600 text-white ring-4 ring-rose-600/20" 
                  : "bg-white text-black hover:bg-gray-100"
              )}
            >
              <Mic size={20} className="md:w-6 md:h-6" />
              {isListening && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
              )}
            </motion.button>
          </div>
          <div className="flex justify-center mt-3 md:mt-4 overflow-hidden">
             <div className="flex gap-4 whitespace-nowrap overflow-hidden">
                {facts.slice(-2).map((fact, i) => (
                  <span key={i} className="text-[9px] md:text-[10px] text-gray-600 font-mono italic">
                    • {fact.length > 25 ? fact.substring(0, 25) + '...' : fact}
                  </span>
                ))}
             </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
