import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase-server";

const UpdateSchema = z.object({
  hint: z.string().min(1).optional(),
});

const paramsSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Invalid session id" },
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

    const { data, error } = await supabase
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
      .eq("id", parsedParams.data.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch session detail", error);
      return NextResponse.json(
        { error: "Unable to fetch the requested session." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const submissions = (data.submissions ?? []).map((submission: any) => ({
      id: submission.id,
      createdAt: submission.created_at,
      userAnswer:
        submission.user_answer !== null && submission.user_answer !== undefined
          ? String(submission.user_answer)
          : "",
      feedback: submission.feedback_text ?? null,
      isCorrect: submission.is_correct,
    }));

    const latestSubmission = submissions.length
      ? submissions.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).at(-1) ?? null
      : null;

    return NextResponse.json({
      session: {
        id: data.id,
        createdAt: data.created_at,
        config: {
          primary: null,
          topic: null,
          difficulty: null,
        },
        problem: data.problem_text,
        answer: data.correct_answer !== null ? String(data.correct_answer) : "",
        working: [],
        hint: null,
        latestSubmission,
        submissions,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/math-sessions/[id]", error);
    return NextResponse.json(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Invalid session id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsedBody = UpdateSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const { hint } = parsedBody.data;

    if (!hint) {
      return NextResponse.json({ updated: false });
    }

    // Hints are not persisted in the current Supabase schema but we still
    // acknowledge the request so the client can cache the latest hint locally.
    return NextResponse.json({ updated: false });
  } catch (error: any) {
    console.error("Error in PATCH /api/math-sessions/[id]", error);
    return NextResponse.json(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
