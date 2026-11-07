import { GoogleGenAI, Type } from "@google/genai";
import { BULK_AI_SYSTEM_PROMPT } from "./constants";
import { getLowPowerResponse, checkGrammarOffline, lookupWordOffline } from "./offline-intelligence";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function analyzeGrammar(message: string) {
  if (!navigator.onLine) {
    const issues = checkGrammarOffline(message);
    if (issues.length > 0) {
      return {
        hasError: true,
        errorType: "Offline Detection",
        correction: "Please review the feedback below.",
        explanation: issues.join(" ")
      };
    }
    return { hasError: false };
  }
  const analysisResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this English sentence for grammar errors (Tense, Verb, Subject-Verb Agreement, Articles).
    Sentence: "${message}"
    
    If there are errors, identify the primary error type and provide a correction.
    If no errors, return { "hasError": false }.`,
    config: {
      systemInstruction: "You are a grammar analyzer. Return only valid JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hasError: { type: Type.BOOLEAN },
          errorType: { type: Type.STRING },
          correction: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["hasError"]
      }
    }
  }).catch(handleGeminiError);

  if (typeof analysisResponse === 'string') return { hasError: false };

  try {
    const text = analysisResponse.text || '{"hasError": false}';
    return JSON.parse(text);
  } catch (e) {
    return { hasError: false };
  }
}

export async function getProactiveOpener(facts: string[], name: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a human-like proactive greeting for ${name}. 
    Use these facts to show curiosity: ${facts.join(', ')}. 
    Don't just say 'Hi'. Reference a past interest or goal in a friendly way.`,
    config: {
      systemInstruction: "You are Bulk AI. A highly empathetic, proactive English coach.",
    },
  }).catch(handleGeminiError);

  if (typeof response === 'string') return response;
  return response.text;
}

export async function generateNeuralReflection(facts: string[]) {
  if (facts.length === 0) return null;
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on these user facts: ${facts.join(', ')}, generate a 1-sentence poetic, ultra-positive "Neural Reflection" about their English journey. Start with something like "Your synapses are firing with..."`,
    config: {
      systemInstruction: "You are the core intelligence of Bulk AI. You see deep into the user's progress.",
    },
  }).catch(handleGeminiError);

  if (typeof response === 'string') return null;
  return response.text;
}

export async function sendMessageToBulkAI(
  message: string, 
  history: { role: 'user' | 'model', content: string }[],
  facts: string[] = [],
  characterPrompt: string = '',
  userName?: string
) {
  if (!navigator.onLine) {
    return getLowPowerResponse(message, userName);
  }
  
  // Rolling memory: Keep only the last 10 exchanges to reduce latency and maintain focus
  const recentHistory = history.slice(-10).map(m => ({ 
    role: m.role, 
    parts: [{ text: m.content }] 
  }));

  const contextPrompt = facts.length > 0 
    ? `\n\nNEURAL MEMORY (User Data):\n${facts.map(f => `- ${f}`).join('\n')}`
    : '';

  const behaviorDirectives = `
  STRICT PHONE CALL BEHAVIOR:
  1. PATIENT LISTENER: Wait for a clear completion. Briefly acknowledge (1-3 words) before depth.
  2. ABSOLUTE BREVITY: Your response MUST be under 25 words (max 2 sentences).
  3. SINGLE QUESTION: You are strictly forbidden from asking more than ONE question.
  4. NATURAL ACKNOWLEDGMENT: Start with a human-like verbal nod (e.g. "I hear you.", "Got it.").
  5. TURN-TAKING: Only speak when the user has clearly finished their thought.
  6. NO ROBOTIC FILLERS: Do not use "As an AI..." or "Let's help you practice."`;

  const fullSystemInstruction = BULK_AI_SYSTEM_PROMPT + contextPrompt + (characterPrompt ? `\n\nCHARACTER PERSONALITY:\n${characterPrompt}` : '') + behaviorDirectives;

  // STEP 1: Generate Raw Response
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...recentHistory,
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: fullSystemInstruction,
      temperature: 0.8,
      topP: 0.95,
    },
  }).catch(handleGeminiError);

  if (typeof response === 'string') return response; 

  const rawText = response.text || "I'm having a small synaptic glitch.";

  // Skip complexity check if it's already a system error or very short
  if (rawText.includes("SYSTEM ALERT")) return rawText;

  // STEP 2: Complexity Model (Self-Correction / Reflection)
  const reflection = await selfCorrectResponse(message, rawText, facts).catch(() => rawText);

  return reflection;
}

export async function selfCorrectResponse(userInput: string, aiResponse: string, facts: string[] = []) {
  const contextPrompt = facts.length > 0 
    ? `\n\nNEURAL MEMORY (Confirmed User Facts):\n${facts.map(f => `- ${f}`).join('\n')}`
    : '';

  const correctionResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `USER INPUT: "${userInput}"
    YOUR RAW DRAFT: "${aiResponse}"
    ${contextPrompt}
    
    COMPLEXITY CHECK (Self-Reflect):
    1. FACTUAL ACCURACY: Does your response contradict any confirmed user facts? 
    2. CONFIDENCE: Are you guessing? If you aren't 100% sure about a user detail, admit you don't know rather than hallucinating.
    3. PEDAGOGY: Did you gently correct the user's grammar if they made a mistake?
    4. BREVITY: Is it phone-call ready (max 25 words)?
    
    If the draft is inaccurate or hallucinated, rewrite it to be truthful and grounded. If you don't know something, say "I don't know yet."
    
    Format: [Correction in brackets if needed] + [Truthful, empathetic response].`,
    config: {
      systemInstruction: "You are the Bulk AI Truth & Complexity Model. You prioritize factual grounding over conversational flair. NEVER invent user details.",
      temperature: 0.1, // Near zero for absolute precision
    },
  }).catch(handleGeminiError);

  if (typeof correctionResponse === 'string') return aiResponse;
  return correctionResponse.text || aiResponse;
}

export async function analyzeExchange(message: string, responseText: string) {
  if (!navigator.onLine) {
    // Basic offline analysis
    const grammarIssues = checkGrammarOffline(message);
    const offlineWord = lookupWordOffline(message);
    
    return {
      grammar: {
        hasError: grammarIssues.length > 0,
        errorType: "Offline Grammar Check",
        explanation: grammarIssues.join(" "),
        correction: ""
      },
      vocabulary: offlineWord ? [offlineWord] : [],
      facts: [] // Offline fact extraction is complex without an LLM
    };
  }

  try {
    const analysisResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a deep neural analysis of this exchange:
      User: ${message}
      AI: ${responseText}
      
      Extract:
      1. Grammar feedback (if errors exist).
      2. New vocabulary words (sophisticated or new for the user).
      3. New personal facts about the user.`,
      config: {
        systemInstruction: "You are the Bulk AI Analyzer. Return only valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            grammar: {
              type: Type.OBJECT,
              properties: {
                hasError: { type: Type.BOOLEAN },
                errorType: { type: Type.STRING },
                correction: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["hasError"]
            },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  pos: { type: Type.STRING }
                },
                required: ["word", "definition", "pos"]
              }
            },
            facts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["grammar", "vocabulary", "facts"]
        }
      }
    }).catch(handleGeminiError);

    if (typeof analysisResponse === 'string') return null;

    const text = analysisResponse.text || '{}';
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function handleGeminiError(error: any) {
  console.error("Gemini Error:", error);
  if (error?.message?.includes("429") || error?.status === 429 || error?.code === 429) {
    return "SYSTEM ALERT: Neural systems are temporarily cooling down due to high load (Quota Exceeded). Please wait a moment before sending another message.";
  }
  return "I'm having a small synaptic glitch. Let's try again!";
}
