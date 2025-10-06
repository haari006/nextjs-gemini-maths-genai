'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractNumericAnswerInputSchema = z.object({
  answer: z.string().describe("The learner's raw answer text."),
});

const ExtractNumericAnswerOutputSchema = z.object({
  numericAnswer: z.number().nullable().describe('The numeric value extracted from the answer, or null if none found.'),
});

export type ExtractNumericAnswerInput = z.infer<typeof ExtractNumericAnswerInputSchema>;
export type ExtractNumericAnswerOutput = z.infer<typeof ExtractNumericAnswerOutputSchema>;

const extractNumericAnswerPrompt = ai.definePrompt({
  name: 'extractNumericAnswerPrompt',
  input: {schema: ExtractNumericAnswerInputSchema},
  output: {schema: ExtractNumericAnswerOutputSchema},
  prompt: `You are a math assistant. Read the student's answer and extract the final numeric value they are giving.

If the student states a number with units (like cm^3 or metres), ignore the units and return just the numeric value.
If there are multiple numbers, choose the value that is clearly presented as the final result.
If you cannot find a numeric value, return null.
`,
});

const extractNumericAnswerFlow = ai.defineFlow(
  {
    name: 'extractNumericAnswerFlow',
    inputSchema: ExtractNumericAnswerInputSchema,
    outputSchema: ExtractNumericAnswerOutputSchema,
  },
  async input => {
    const {output} = await extractNumericAnswerPrompt(input);
    return output!;
  }
);

export async function extractNumericAnswer(
  input: ExtractNumericAnswerInput
): Promise<ExtractNumericAnswerOutput> {
  return extractNumericAnswerFlow(input);
}
