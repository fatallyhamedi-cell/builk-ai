
/**
 * Offline Intelligence for Bulk AI
 * Provides minimal rule-based logic for dictionary, grammar, and responses
 * when the neural link (Gemini) is severed.
 */

export interface OfflineDictionaryEntry {
  word: string;
  definition: string;
  pos: string;
  example: string;
}

// Minimal common dictionary for offline use
export const OFFLINE_DICTIONARY: Record<string, OfflineDictionaryEntry> = {
  "meticulous": {
    word: "meticulous",
    pos: "adjective",
    definition: "showing great attention to detail; very careful and precise",
    example: "He was meticulous about keeping his neural logs organized."
  },
  "sophisticated": {
    word: "sophisticated",
    pos: "adjective",
    definition: "having, revealing, or proceeding from a great deal of worldly experience and knowledge of fashion and culture",
    example: "The new AI model uses a sophisticated neural architecture."
  },
  "eloquent": {
    word: "eloquent",
    pos: "adjective",
    definition: "fluent or persuasive in speaking or writing",
    example: "She gave an eloquent speech about the future of offline AI."
  },
  "resilient": {
    word: "resilient",
    pos: "adjective",
    definition: "able to withstand or recover quickly from difficult conditions",
    example: "Bulk AI is resilient even when the internet goes out."
  }
};

/**
 * Basic offline grammar rules
 */
export function checkGrammarOffline(text: string) {
  const issues: string[] = [];
  const lower = text.toLowerCase();

  // Common errors
  if (lower.includes(" i ") || lower.startsWith("i ")) {
    issues.push("Remember to capitalize 'I' when referring to yourself.");
  }
  
  if (lower.includes(" he go ") || lower.includes(" she go ")) {
    issues.push("Use 'goes' for third-person singular (he/she/it goes).");
  }

  if (lower.includes(" i is ")) {
    issues.push("Use 'I am' instead of 'I is'.");
  }

  if (!/[.!?]$/.test(text.trim())) {
    issues.push("Try to end your sentences with proper punctuation.");
  }

  return issues;
}

/**
 * Offline Dictionary Lookup
 */
export function lookupWordOffline(text: string): OfflineDictionaryEntry | null {
  const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
  for (const word of words) {
    if (OFFLINE_DICTIONARY[word]) {
      return OFFLINE_DICTIONARY[word];
    }
  }
  return null;
}

/**
 * Generates a "low-power" response based on simple keyword matching
 * to maintain conversation flow while offline.
 */
export function getLowPowerResponse(text: string, userName?: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return `Hey ${userName || 'there'}! I'm in low-power offline mode right now, but I'm still listening. How can I help you practice today?`;
  }

  if (lower.includes("how are you")) {
    return "My neural processor is cooling down since we're offline, but my core systems are stable! How about you?";
  }

  if (lower.includes("help") || lower.includes("stuck")) {
    return "I'm limited while offline, but we can still practice basic conversation. Tell me about your day!";
  }

  if (lower.includes("weather")) {
    return "I can't check the live weather while my neural link is down, but I hope it's nice where you are!";
  }

  return "I've logged your message in my local memory. I'm in low-power mode, so my responses are a bit simpler until we reconnect. What else is on your mind?";
}
