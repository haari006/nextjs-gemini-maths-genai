import { NextRequest, NextResponse } from 'next/server';
import { provideHint } from '@/ai/flows/provide-hint';
import { z } from 'zod';

const ProvideHintRequestSchema = z.object({
  problem: z.string(),
  working: z.array(z.object({
    step: z.number(),
    explanation: z.string(),
    formula: z.string(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = ProvideHintRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const result = await provideHint(validation.data);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in /api/provide-hint:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
