import { useState, useCallback, useRef } from 'react';

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

  const startListening = useCallback((onResult: (text: string) => void, onSpeechStart?: () => void, onError?: (error: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onError) onError("Speech recognition not supported in this browser.");
      else alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onspeechstart = () => {
      if (onSpeechStart) onSpeechStart();
    };

    recognition.onspeechend = () => {
      // Logic for speech ending, often precedes onresult
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Handle silently to avoid log clutter in auto-listen loops
      } else if (event.error === 'network') {
        // Some browsers (like desktop Chrome) require an internet connection for Speech Recognition.
        // We handle this gracefully since Bulk AI is designed for offline use - 
        // we'll just notify the UI that the network-dependent voice features are currently restricted.
        if (onError) onError("network");
      } else {
        console.error("Speech recognition error:", event.error);
        if (onError) onError(event.error);
      }
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      if (onError) onError("start-failed");
      setIsListening(false);
    }
    recognitionRef.current = recognition;
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const getPreferredVoice = useCallback(() => {
    if (!synthRef.current) return null;
    const voices = synthRef.current.getVoices();
    return voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
           voices.find(v => v.lang === 'en-US' && v.name.includes('Natural')) ||
           voices.find(v => v.lang === 'en-US') ||
           voices.find(v => v.lang.startsWith('en-')) ||
           null;
  }, []);

  const primeVoice = useCallback(() => {
    if (!synthRef.current) return;
    try {
      // Warm up TTS to satisfy browser autoplay requirements
      const utterance = new SpeechSynthesisUtterance('');
      synthRef.current.speak(utterance);
      synthRef.current.cancel();
    } catch (e) {
      console.warn("Speech Synthesis priming failed:", e);
    }
  }, []);

  const speak = useCallback((text: string, options?: { rate?: number; pitch?: number }) => {
    if (!synthRef.current) return;

    // Cancel any existing speech and reset state
    synthRef.current.cancel();
    setIsSpeaking(false);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;

    const voice = getPreferredVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    try {
      synthRef.current.speak(utterance);
    } catch (e) {
      console.error("Speech Synthesis speak failed:", e);
      setIsSpeaking(false);
    }
  }, [getPreferredVoice]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    primeVoice
  };
}
