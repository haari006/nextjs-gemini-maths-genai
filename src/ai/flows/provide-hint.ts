'use server';

/**
 * @fileOverview Provides a hint for a given math problem.
 *
 * - provideHint - A function that generates a hint.
 * - ProvideHintInput - The input type for the provideHint function.
 * - ProvideHintOutput - The return type for the provideHint function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProvideHintInputSchema = z.object({
  problem: z.string().describe('The math word problem that the student needs a hint for.'),
  working: z.array(z.object({
    step: z.number(),
    explanation: z.string(),
    formula: z.string(),
  })).describe('The step-by-step working to solve the problem.'),
});
export type ProvideHintInput = z.infer<typeof ProvideHintInputSchema>;

const ProvideHintOutputSchema = z.object({
  hint: z.string().describe('A helpful hint for the student. The hint should guide the student on the first or next step without giving away the answer. It can be a question to prompt their thinking.'),
});
export type ProvideHintOutput = z.infer<typeof ProvideHintOutputSchema>;

export async function provideHint(input: ProvideHintInput): Promise<ProvideHintOutput> {
  return provideHintFlow(input);
}

const provideHintPrompt = ai.definePrompt({
  name: 'provideHintPrompt',
  input: {schema: ProvideHintInputSchema},
  output: {schema: ProvideHintOutputSchema},
  prompt: `You are a helpful math tutor. The student is stuck on the following problem and needs a hint.

Problem:
"{{problem}}"

Solution Steps:
{{#each working}}
Step {{step}}: {{explanation}}
{{/each}}

Provide a short, guiding hint to help the student figure out the *next* step they should take. Do not give away the actual calculation or answer for the step. Instead, ask a question or provide a general strategy.`,
});

const provideHintFlow = ai.defineFlow(
  {
    name: 'provideHintFlow',
    inputSchema: ProvideHintInputSchema,
    outputSchema: ProvideHintOutputSchema,
  },
  async input => {
    const {output} = await provideHintPrompt(input);
    return output!;
  }
);
