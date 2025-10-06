"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase-client";
import type { ProblemHistory, Score } from "@/types/math";

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
      const correct = submissions.filter((submission) => submission.is_correct).length;
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
            user_answer,
            is_correct
          )
        `
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (!historyError && historyData) {
      setHistory(historyData as ProblemHistory);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { score, history, loading, refresh };
}
