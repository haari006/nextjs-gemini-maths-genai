import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateMathProblemOutputWorkingSchema } from "@/types/math";

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

    const workingResult = generateMathProblemOutputWorkingSchema.safeParse(data.working_steps);

    const submissions = (data.submissions ?? []).map((submission: any) => ({
      id: submission.id,
      createdAt: submission.created_at,
      userAnswer: submission.user_answer,
      feedback: submission.feedback,
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
          primary: data.primary_level,
          topic: data.topic,
          difficulty: data.difficulty,
        },
        problem: data.problem_text,
        answer: data.answer_text,
        working: workingResult.success ? workingResult.data : [],
        hint: data.latest_hint ?? null,
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

    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client is not configured." },
        { status: 500 }
      );
    }

    const { error } = await supabase
      .from("math_problem_sessions")
      .update({ latest_hint: hint })
      .eq("id", parsedParams.data.id);

    if (error) {
      console.error("Failed to update session hint", error);
      return NextResponse.json(
        { error: "Unable to store hint." },
        { status: 500 }
      );
    }

    return NextResponse.json({ updated: true });
  } catch (error: any) {
    console.error("Error in PATCH /api/math-sessions/[id]", error);
    return NextResponse.json(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
