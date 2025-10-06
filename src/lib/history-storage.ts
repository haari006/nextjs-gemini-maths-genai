import type { GenerateMathProblemOutput } from "@/ai/flows/generate-math-problems";

export type StoredQuestionSession = {
  id: string;
  createdAt: string;
  config: {
    primary: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
  };
  problem: string;
  answer: string;
  working: GenerateMathProblemOutput["working"];
  userAnswerHtml?: string;
  userAnswerText?: string;
  feedback?: string;
  isCorrect?: boolean;
  hint?: string;
};

export const HISTORY_STORAGE_KEY = "math-buddy-history";

export function loadHistory(): StoredQuestionSession[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredQuestionSession[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    console.warn("Unable to parse stored Math Buddy history", error);
    return [];
  }
}

export function saveHistory(entries: StoredQuestionSession[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn("Unable to persist Math Buddy history", error);
  }
}

export function getSessionFromHistory(id: string): StoredQuestionSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const history = loadHistory();
  return history.find((entry) => entry.id === id) ?? null;
}
