'use server';

/**
 * @fileOverview Generates math word problems for Primary 5 students using AI.
 */

import {ai, getAI} from '@/ai/genkit';
import {GEMINI_MODEL_VALUES, type GeminiModelValue} from '@/lib/gemini-models';
import {z} from 'genkit';

const GenerateMathProblemInputSchema = z.object({
  primary: z.string().describe('The primary level of the student (e.g., Primary5).'),
  topic: z.string().describe('The topic of the math problem (e.g., fractions, decimals, percentage).'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the math problem.'),
  questionType: z.enum(['subjective', 'multipleChoice']).describe('The type of question to generate.'),
});
export type GenerateMathProblemInput = z.infer<typeof GenerateMathProblemInputSchema>;

type SupportedModel = GeminiModelValue;

const GenerateMathProblemOutputSchema = z.object({
  problem: z.string().describe('The generated math word problem. Use LaTeX for any mathematical expressions, delimited by $.'),
  answer: z.string().describe('The correct answer to the generated math problem.'),
  working: z
    .array(
      z.object({
        step: z.number().describe('The step number.'),
        explanation: z.string().describe('A plain text explanation of what is being calculated in this step.'),
        formula: z
          .string()
          .describe('The LaTeX formula or calculation for this step. Use \\text{...} for words and \\\\ for new lines.'),
      })
    )
    .describe('The step-by-step working to solve the problem.'),
  choices: z
    .array(
      z.object({
        id: z.string().describe('A stable identifier for the choice (e.g., A, B, C, D).'),
        label: z.string().describe('The text shown to the learner.'),
        value: z.string().describe('The numeric value represented by the choice.'),
      })
    )
    .describe('Multiple choice options when questionType is multipleChoice.')
    .default([]),
});
export type GenerateMathProblemOutput = z.infer<typeof GenerateMathProblemOutputSchema>;

const generatePromptByModel = new Map<
  SupportedModel,
  ReturnType<typeof ai.definePrompt<GenerateMathProblemInput, GenerateMathProblemOutput>>
>();

const generateFlowByModel = new Map<
  SupportedModel,
  ReturnType<typeof ai.defineFlow<GenerateMathProblemInput, GenerateMathProblemOutput>>
>();

function getGenerateFlow(model: SupportedModel) {
  if (!generateFlowByModel.has(model)) {
    const client = model === 'googleai/gemini-2.5-flash' ? ai : getAI(model);
    const prompt = client.definePrompt({
      name: `generateMathProblemPrompt-${model.replace(/[^a-z0-9]/gi, '-')}`,
      input: {schema: GenerateMathProblemInputSchema},
      output: {schema: GenerateMathProblemOutputSchema},
      prompt: `You are a math teacher for the {{primary}} level. Generate a math problem based on the topic, difficulty, and question type.

Question type: {{questionType}}
Topic: {{{topic}}}
Difficulty: {{{difficulty}}}

Always ensure the final numeric answer can be parsed as a number. If the question type is "multipleChoice", provide exactly four options in the choices array. Each choice must include an id (A, B, C, D), a descriptive label, and a numeric value string that matches what appears in the label. Exactly one choice must be correct and match the answer. If the question type is "subjective", return an empty choices array and craft a short word problem that expects the learner to type their own numeric answer.

Provide a step-by-step working for the problem. Each step should include a plain text explanation and the corresponding LaTeX formula. End the working by highlighting the final answer, making sure the answer field is just the numeric result (no units).`,
    });

    generatePromptByModel.set(model, prompt);

    const flow = client.defineFlow(
      {
        name: `generateMathProblemFlow-${model.replace(/[^a-z0-9]/gi, '-')}`,
        inputSchema: GenerateMathProblemInputSchema,
        outputSchema: GenerateMathProblemOutputSchema,
      },
      async input => {
        const {output} = await prompt(input);
        return output!;
      }
    );

    generateFlowByModel.set(model, flow);
  }

  return generateFlowByModel.get(model)!;
}

export async function generateMathProblem(
  input: GenerateMathProblemInput,
  options?: { model?: SupportedModel }
): Promise<GenerateMathProblemOutput> {
  const model = options?.model ?? GEMINI_MODEL_VALUES[0];
  const flow = getGenerateFlow(model);
  return flow(input);
}
