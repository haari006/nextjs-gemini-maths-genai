import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase-server";

const WorkingStepSchema = z.object({
  step: z.number(),
  explanation: z.string(),
  formula: z.string(),
});

const CreateSessionSchema = z.object({
  config: z.object({
    primary: z.string(),
    topic: z.string(),
    difficulty: z.enum(["easy", "medium", "hard"]),
  }),
  problem: z.string(),
  answer: z.string(),
  working: z.array(WorkingStepSchema),
});

const ListQuerySchema = z.object({
  status: z.enum(["all", "correct", "incorrect", "pending"]).default("all"),
  difficulty: z.enum(["all", "easy", "medium", "hard"]).default("all"),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 20))
    .pipe(z.number().int().positive().max(100)),
});

function normalizeWorking(working: unknown) {
  const result = WorkingStepSchema.array().safeParse(working);
  return result.success ? result.data : [];
}

function computeLatestSubmission(submissions: any[] = []) {
  if (!submissions.length) return null;
  const sorted = [...submissions].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted[sorted.length - 1];
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = CreateSessionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client is not configured." },
        { status: 500 }
      );
    }

    const { config, problem, answer, working } = parsed.data;

    const { data, error } = await supabase
      .from("math_problem_sessions")
      .insert({
        primary_level: config.primary,
        topic: config.topic,
        difficulty: config.difficulty,
        problem_text: problem,
        answer_text: answer,
        working_steps: working,
      })
      .select(
        `id, created_at, primary_level, topic, difficulty, problem_text, answer_text, working_steps, latest_hint`
      )
      .single();

    if (error) {
      console.error("Failed to store math session", error);
      return NextResponse.json(
        { error: "Unable to store the generated session." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session: {
        id: data.id,
        createdAt: data.created_at,
        config: {
          primary: data.primary_level,
          topic: data.topic,
          difficulty: data.difficulty,
        },
        problem: data.problem_text,
        answer: data.answer_text,
        working: normalizeWorking(data.working_steps),
        hint: data.latest_hint ?? null,
        latestSubmission: null,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/math-sessions", error);
    return NextResponse.json(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
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

    const parsedQuery = ListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsedQuery.error.flatten() },
        { status: 400 }
      );
    }

    const { status, difficulty, limit } = parsedQuery.data;

    let query = supabase
      .from("math_problem_sessions")
      .select(
        `
          id,
          created_at,
          primary_level,
          topic,
          difficulty,
          problem_text,
          answer_text,
          working_steps,
          latest_hint,
          submissions:math_problem_submissions(
            id,
            created_at,
            user_answer,
            feedback,
            is_correct
          )
        `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (difficulty !== "all") {
      query = query.eq("difficulty", difficulty);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to load math sessions", error);
      return NextResponse.json(
        { error: "Unable to fetch session history." },
        { status: 500 }
      );
    }

    const filtered = (data ?? []).filter((session) => {
      const latest = computeLatestSubmission(session.submissions ?? []);
      if (status === "all") return true;
      if (status === "pending") {
        return !latest;
      }
      if (!latest) return false;
      if (status === "correct") {
        return latest.is_correct === true;
      }
      if (status === "incorrect") {
        return latest.is_correct === false;
      }
      return true;
    });

    const sessions = filtered.map((session) => {
      const latest = computeLatestSubmission(session.submissions ?? []);
      return {
        id: session.id,
        createdAt: session.created_at,
        config: {
          primary: session.primary_level,
          topic: session.topic,
          difficulty: session.difficulty,
        },
        problem: session.problem_text,
        answer: session.answer_text,
        working: normalizeWorking(session.working_steps),
        hint: session.latest_hint ?? null,
        latestSubmission: latest
          ? {
              id: latest.id,
              createdAt: latest.created_at,
              userAnswer: latest.user_answer,
              feedback: latest.feedback,
              isCorrect: latest.is_correct,
            }
          : null,
      };
    });

    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("Error in GET /api/math-sessions", error);
    return NextResponse.json(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
