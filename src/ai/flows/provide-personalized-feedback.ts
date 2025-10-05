'use server';

/**
 * @fileOverview Provides personalized feedback on student's math problem answers.
 *
 * - providePersonalizedFeedback - A function that generates personalized feedback.
 * - ProvidePersonalizedFeedbackInput - The input type for the providePersonalizedFeedback function.
 * - ProvidePersonalizedFeedbackOutput - The return type for the providePersonalizedFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProvidePersonalizedFeedbackInputSchema = z.object({
  problem: z.string().describe('The math word problem that the student attempted.'),
  studentAnswer: z.string().describe("The student's answer to the math problem."),
  correctAnswer: z.string().describe('The correct answer to the math problem.'),
});
export type ProvidePersonalizedFeedbackInput = z.infer<
  typeof ProvidePersonalizedFeedbackInputSchema
>;

const ProvidePersonalizedFeedbackOutputSchema = z.object({
  feedback: z.string().describe('Personalized feedback for the student.'),
});
export type ProvidePersonalizedFeedbackOutput = z.infer<
  typeof ProvidePersonalizedFeedbackOutputSchema
>;

export async function providePersonalizedFeedback(
  input: ProvidePersonalizedFeedbackInput
): Promise<ProvidePersonalizedFeedbackOutput> {
  return providePersonalizedFeedbackFlow(input);
}

const providePersonalizedFeedbackPrompt = ai.definePrompt({
  name: 'providePersonalizedFeedbackPrompt',
  input: {schema: ProvidePersonalizedFeedbackInputSchema},
  output: {schema: ProvidePersonalizedFeedbackOutputSchema},
  prompt: `You are an encouraging and helpful math tutor for a Primary 5 student.

The student attempted the following problem:
"{{problem}}"

The correct answer is: {{correctAnswer}}
The student's answer was: {{studentAnswer}}

Please provide short, encouraging, and helpful feedback to the student.
If the answer is correct, praise them.
If the answer is incorrect, gently point out the mistake without giving away the direct answer, and encourage them to try again.`,
});

const providePersonalizedFeedbackFlow = ai.defineFlow(
  {
    name: 'providePersonalizedFeedbackFlow',
    inputSchema: ProvidePersonalizedFeedbackInputSchema,
    outputSchema: ProvidePersonalizedFeedbackOutputSchema,
  },
  async input => {
    const {output} = await providePersonalizedFeedbackPrompt(input);
    return output!;
  }
);
