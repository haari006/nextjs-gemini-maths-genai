"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase-client";
import type {
  ProblemHistory,
  ProblemHistoryEntry,
  ProblemSubmission,
  Score,
} from "@/types/math";

function mapSubmission(raw: any): ProblemSubmission {
  return {
    id: raw.id,
    created_at: raw.created_at,
    user_answer: raw.user_answer,
    feedback: raw.feedback ?? null,
    is_correct: raw.is_correct ?? null,
  };
}

function mapHistoryEntry(raw: any): ProblemHistoryEntry {
  return {
    id: raw.id,
    created_at: raw.created_at,
    problem_text: raw.problem_text,
    submissions: Array.isArray(raw.submissions)
      ? raw.submissions.map(mapSubmission)
      : [],
  };
}

export function useMathProgress() {
  const [score, setScore] = useState<Score>({ correct: 0, total: 0 });
  const [history, setHistory] = useState<ProblemHistory>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    const { data: submissions, error: submissionsError } = await supabase
      .from("math_problem_submissions")
      .select("is_correct");

    if (!submissionsError && submissions) {
      const correct = submissions.filter(
        (submission) => submission.is_correct
      ).length;
      const total = submissions.length;
      setScore({ correct, total });
    }

    const { data: historyData, error: historyError } = await supabase
      .from("math_problem_sessions")
      .select(
        `
          id,
          created_at,
          problem_text,
          submissions:math_problem_submissions (
            id,
            created_at,
            user_answer,
            feedback_text,
            is_correct
          )
        `
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (!historyError && historyData) {
      setHistory(historyData.map(mapHistoryEntry));
      console.log(historyData);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { score, history, loading, refresh };
}
