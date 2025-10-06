import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase-server";

const PastQuestionsQuerySchema = z.object({
  status: z.enum(["all", "correct", "incorrect", "pending"]).default("all"),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 40))
    .pipe(z.number().int().positive().max(100)),
});

function computeLatestSubmission(submissions: any[] = []) {
  if (!submissions.length) return null;
  const sorted = [...submissions].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted.at(-1) ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client is not configured." },
        { status: 500 }
      );
    }

    const parsed = PastQuestionsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, limit } = parsed.data;

    let query = supabase
      .from("math_problem_sessions")
      .select(
        `
          id,
          created_at,
          problem_text,
          correct_answer,
          submissions:math_problem_submissions(
            id,
            created_at,
            user_answer,
            feedback_text,
            is_correct
          )
        `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "correct") {
      query = query.eq("math_problem_submissions.is_correct", true);
    } else if (status === "incorrect") {
      query = query.eq("math_problem_submissions.is_correct", false);
    } else if (status === "pending") {
      query = query.is("math_problem_submissions.id", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to load past questions", error);
      return NextResponse.json(
        { error: "Unable to fetch past questions." },
        { status: 500 }
      );
    }

    const sessions = (data ?? [])
      .map((session) => {
        const latest = computeLatestSubmission(session.submissions ?? []);

        if (status === "pending" && latest) return null;
        if (status === "correct" && (!latest || latest.is_correct !== true)) return null;
        if (status === "incorrect" && (!latest || latest.is_correct !== false)) return null;

        return {
          id: session.id,
          createdAt: session.created_at,
          config: {
            primary: null,
            topic: null,
            difficulty: null,
            questionType: null,
            model: null,
          },
          problem: session.problem_text,
          answer: session.correct_answer !== null ? String(session.correct_answer) : "",
          working: [],
          hint: null,
          choices: [],
          latestSubmission: latest
            ? {
                id: latest.id,
                createdAt: latest.created_at,
                userAnswer:
                  latest.user_answer !== null && latest.user_answer !== undefined
                    ? String(latest.user_answer)
                    : "",
                feedback: latest.feedback_text ?? null,
                isCorrect: latest.is_correct,
              }
            : null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("Error in GET /api/past-questions", error);
    return NextResponse.json(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
