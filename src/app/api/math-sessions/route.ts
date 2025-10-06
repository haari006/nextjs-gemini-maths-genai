import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase-server";

const WorkingStepSchema = z.object({
  step: z.number(),
  explanation: z.string(),
  formula: z.string(),
});

const ChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

const CreateSessionSchema = z.object({
  config: z.object({
    primary: z.string(),
    topic: z.string(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    questionType: z.enum(["subjective", "multipleChoice"]).default("subjective"),
    model: z.string().optional(),
  }),
  problem: z.string(),
  answer: z.string(),
  working: z.array(WorkingStepSchema),
  choices: z.array(ChoiceSchema).optional(),
});

const ListQuerySchema = z.object({
  status: z.enum(["all", "correct", "incorrect", "pending"]).default("all"),
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

function normalizeChoices(choices: unknown) {
  if (!choices) return [];
  const parsed = ChoiceSchema.array().safeParse(choices);
  return parsed.success ? parsed.data : [];
}

function computeLatestSubmission(submissions: any[] = []) {
  if (!submissions.length) return null;
  const sorted = [...submissions].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted[sorted.length - 1];
}

function stripHtml(input: string) {
  return input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function toPlainText(input: string) {
  return stripHtml(input).replace(/\s+/g, " ").trim();
}

function parseNumericAnswer(value: string) {
  const cleaned = value
    .replace(/<[^>]+>/g, " ")
    .replace(/,/g, "")
    .replace(/[a-zA-Z%°]+/g, (segment) => (/(cm|mm|m|km|g|kg|l|ml|°C|°F)/i.test(segment) ? "" : " "))
    .trim();
  if (!cleaned) {
    return null;
  }

  const fractionMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }

  const percentMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
  if (percentMatch) {
    const numeric = parseFloat(percentMatch[1]);
    if (!Number.isNaN(numeric)) {
      return numeric / 100;
    }
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
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
    const choices = normalizeChoices(parsed.data.choices ?? []);

    const numericAnswer = parseNumericAnswer(toPlainText(answer));

    if (numericAnswer === null) {
      return NextResponse.json(
        { error: "The generated answer could not be stored as a number." },
        { status: 422 }
      );
    }

    const { data, error } = await supabase
      .from("math_problem_sessions")
      .insert({
        problem_text: problem,
        correct_answer: numericAnswer,
      })
      .select(`id, created_at, problem_text, correct_answer`)
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
          primary: config.primary ?? null,
          topic: config.topic ?? null,
          difficulty: config.difficulty ?? null,
          questionType: config.questionType ?? null,
          model: config.model ?? null,
        },
        problem: data.problem_text,
        answer,
        working: normalizeWorking(working),
        hint: null,
        choices,
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

    const { status, limit } = parsedQuery.data;

    const query = supabase
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
