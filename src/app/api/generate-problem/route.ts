import { NextRequest, NextResponse } from 'next/server';
import { generateMathProblem } from '@/ai/flows/generate-math-problems';
import { GEMINI_MODEL_VALUES } from '@/lib/gemini-models';
import { z } from 'zod';

const GenerateProblemRequestSchema = z.object({
  primary: z.string(),
  topic: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionType: z.enum(['subjective', 'multipleChoice']).default('subjective'),
  model: z.enum(GEMINI_MODEL_VALUES).default('googleai/gemini-2.5-flash'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = GenerateProblemRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { primary, topic, difficulty, questionType, model } = validation.data;

    const result = await generateMathProblem(
      {
        primary,
        topic,
        difficulty,
        questionType,
      },
      { model }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/generate-problem:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
