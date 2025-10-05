'use server';

/**
 * @fileOverview Generates math word problems for Primary 5 students using AI.
 *
 * - generateMathProblem - A function that handles the math problem generation process.
 * - GenerateMathProblemInput - The input type for the generateMathProblem function.
 * - GenerateMathProblemOutput - The return type for the generateMathProblem function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMathProblemInputSchema = z.object({
  primary: z.string().describe('The primary level of the student (e.g., Primary5).'),
  topic: z.string().describe('The topic of the math problem (e.g., fractions, decimals, percentage).'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the math problem.'),
});
export type GenerateMathProblemInput = z.infer<typeof GenerateMathProblemInputSchema>;

const GenerateMathProblemOutputSchema = z.object({
  problem: z.string().describe('The generated math word problem. Use LaTeX for any mathematical expressions, delimited by $.'),
  answer: z.string().describe('The correct answer to the generated math problem.'),
  working: z.array(z.object({
    step: z.number().describe('The step number.'),
    explanation: z.string().describe('A plain text explanation of what is being calculated in this step.'),
    formula: z.string().describe('The LaTeX formula or calculation for this step. Use \\text{...} for words and \\\\ for new lines.'),
  })).describe('The step-by-step working to solve the problem.'),
});
export type GenerateMathProblemOutput = z.infer<typeof GenerateMathProblemOutputSchema>;

export async function generateMathProblem(input: GenerateMathProblemInput): Promise<GenerateMathProblemOutput> {
  return generateMathProblemFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMathProblemPrompt',
  input: {schema: GenerateMathProblemInputSchema},
  output: {schema: GenerateMathProblemOutputSchema},
  prompt: `You are a math teacher for the {{primary}} level. Generate a math word problem based on the following topic and difficulty level.

For any mathematical expressions in the problem statement, use LaTeX syntax delimited by $. For example: "What is the value of $x$ if $2x + 5 = 15$?".

Provide a step-by-step working for the problem. Each step should include a plain text explanation and the corresponding LaTeX formula.
Make sure the final answer is a number.

Topic: {{{topic}}}
Difficulty: {{{difficulty}}}`,
});

const generateMathProblemFlow = ai.defineFlow(
  {
    name: 'generateMathProblemFlow',
    inputSchema: GenerateMathProblemInputSchema,
    outputSchema: GenerateMathProblemOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
