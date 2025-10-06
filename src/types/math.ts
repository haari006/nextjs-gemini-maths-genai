export type Score = {
  correct: number;
  total: number;
};

export type ProblemSubmission = {
  user_answer: number;
  is_correct: boolean;
};

export type ProblemHistoryEntry = {
  id: string;
  created_at: string;
  problem_text: string;
  submissions: ProblemSubmission[];
};

export type ProblemHistory = ProblemHistoryEntry[];
