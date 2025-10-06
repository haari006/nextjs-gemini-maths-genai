import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { extractNumericAnswer } from "@/ai/flows/extract-numeric-answer";
import { providePersonalizedFeedback } from "@/ai/flows/provide-personalized-feedback";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const SubmissionSchema = z.object({
  problem: z.string(),
  correctAnswer: z.string(),
  studentAnswer: z.string(),
});

function toPlainText(input: string) {
  return input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericAnswer(value: string) {
  const cleaned = toPlainText(value)
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

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const sessionId = typeof params?.id === "string" && params.id.trim() ? params.id.trim() : null;
    if (!sessionId) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
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

    let numericStudentAnswer = parseNumericAnswer(studentAnswer);
    if (numericStudentAnswer === null) {
      try {
        const aiResult = await extractNumericAnswer({ answer: studentAnswer });
        numericStudentAnswer = aiResult.numericAnswer;
      } catch (error) {
        console.warn("Failed to extract numeric answer with AI", error);
      }
    }

    if (numericStudentAnswer === null) {
      return NextResponse.json(
        { error: "We couldn't understand the numeric value in your answer. Try stating the number clearly." },
        { status: 422 }
      );
    }

    const numericCorrectAnswer = parseNumericAnswer(correctAnswer);
    if (numericCorrectAnswer === null) {
      return NextResponse.json(
        { error: "The correct answer could not be evaluated." },
        { status: 500 }
      );
    }

    const isCorrect = Math.abs(numericCorrectAnswer - numericStudentAnswer) < 0.001;

    const feedbackResult = await providePersonalizedFeedback({
      problem,
      studentAnswer,
      correctAnswer,
    });

    const { data, error } = await supabase
      .from("math_problem_submissions")
      .insert({
        session_id: sessionId,
        user_answer: numericStudentAnswer,
        is_correct: isCorrect,
        feedback_text: feedbackResult.feedback,
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
