import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { providePersonalizedFeedback } from "@/ai/flows/provide-personalized-feedback";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const SubmissionSchema = z.object({
  problem: z.string(),
  correctAnswer: z.string(),
  studentAnswer: z.string(),
});

const paramsSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
});

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
  const cleaned = value.replace(/,/g, "").trim();
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

function answersMatch(correctAnswer: string, studentAnswer: string) {
  const plainCorrect = toPlainText(correctAnswer).toLowerCase();
  const plainStudent = toPlainText(studentAnswer).toLowerCase();

  const numericCorrect = parseNumericAnswer(plainCorrect);
  const numericStudent = parseNumericAnswer(plainStudent);

  if (numericCorrect !== null && numericStudent !== null) {
    return Math.abs(numericCorrect - numericStudent) < 0.001;
  }

  return plainCorrect === plainStudent;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Invalid session id" },
        { status: 400 }
      );
    }

    const payload = await request.json();
    const parsedPayload = SubmissionSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsedPayload.error.flatten() },
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

    const { problem, correctAnswer, studentAnswer } = parsedPayload.data;

    const isCorrect = answersMatch(correctAnswer, studentAnswer);

    const feedbackResult = await providePersonalizedFeedback({
      problem,
      studentAnswer,
      correctAnswer,
    });

    const { data, error } = await supabase
      .from("math_problem_submissions")
      .insert({
        session_id: parsedParams.data.id,
        user_answer: studentAnswer,
        is_correct: isCorrect,
        feedback: feedbackResult.feedback,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Failed to save submission", error);
      return NextResponse.json(
        { error: "Unable to record submission." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      submission: {
        id: data.id,
        createdAt: data.created_at,
        userAnswer: studentAnswer,
        feedback: feedbackResult.feedback,
        isCorrect,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/math-sessions/[id]/submissions", error);
    return NextResponse.json(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
