import { z } from "zod";

export const workingStepSchema = z.object({
  step: z.number(),
  explanation: z.string(),
  formula: z.string(),
});

export const generateMathProblemOutputWorkingSchema = z.array(workingStepSchema);

export type WorkingStep = z.infer<typeof workingStepSchema>;

export type Score = {
  correct: number;
  total: number;
};

export type ProblemSubmission = {
  id: string;
  created_at: string;
  user_answer: string;
  feedback?: string | null;
  is_correct: boolean | null;
};

export type ProblemHistoryEntry = {
  id: string;
  created_at: string;
  problem_text: string;
  submissions: ProblemSubmission[];
};

export type ProblemHistory = ProblemHistoryEntry[];

export type SessionConfig = {
  primary: string | null;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
};

export type MathSessionSummary = {
  id: string;
  createdAt: string;
  config: SessionConfig;
  problem: string;
  answer: string;
  working: WorkingStep[];
  hint: string | null;
  latestSubmission: {
    id: string;
    createdAt: string;
    userAnswer: string;
    feedback: string | null;
    isCorrect: boolean | null;
  } | null;
};

export type MathSessionDetail = MathSessionSummary & {
  submissions: {
    id: string;
    createdAt: string;
    userAnswer: string;
    feedback: string | null;
    isCorrect: boolean | null;
  }[];
};
