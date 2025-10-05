import { NextRequest, NextResponse } from 'next/server';
import { providePersonalizedFeedback } from '@/ai/flows/provide-personalized-feedback';
import { z } from 'zod';

const ProvideFeedbackRequestSchema = z.object({
  problem: z.string(),
  studentAnswer: z.string(),
  correctAnswer: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = ProvideFeedbackRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const result = await providePersonalizedFeedback(validation.data);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/provide-feedback:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
