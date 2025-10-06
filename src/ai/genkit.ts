import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const defaultModel = process.env.GOOGLE_DEFAULT_MODEL ?? 'googleai/gemini-2.5-flash';

const clients = new Map<string, ReturnType<typeof genkit>>();

export function getAI(model: string = defaultModel) {
  if (!clients.has(model)) {
    clients.set(
      model,
      genkit({
        plugins: [googleAI()],
        model,
      })
    );
  }

  return clients.get(model)!;
}

export const ai = getAI();
