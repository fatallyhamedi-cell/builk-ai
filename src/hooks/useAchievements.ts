import { useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, onSnapshot, setDoc, serverTimestamp, query, doc, getDocs } from 'firebase/firestore';

const ACHIEVEMENTS = [
  { id: 'first_word', name: 'First Word', icon: '🎯', condition: (msgs: number) => msgs >= 1 },
  { id: 'chatterbox', name: 'Chatterbox', icon: '💬', condition: (msgs: number) => msgs >= 20 },
  { id: 'steady_learner', name: 'Steady Learner', icon: '🔥', condition: (msgs: number) => msgs >= 100 },
];

export function useAchievements() {
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const convId = 'default_conversation';
    const messagesRef = collection(db, 'users', user.uid, 'conversations', convId, 'messages');

    return onSnapshot(messagesRef, async (snapshot) => {
      const messageCount = snapshot.size;
      
      for (const ach of ACHIEVEMENTS) {
        if (ach.condition(messageCount)) {
          // Grant achievement if not already granted
          const { condition, ...data } = ach;
          await setDoc(doc(db, 'users', user.uid, 'achievements', ach.id), {
            ...data,
            earnedAt: serverTimestamp()
          }, { merge: true });
        }
      }
    });
  }, [user]);
}
