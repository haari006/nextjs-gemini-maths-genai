export const GEMINI_MODEL_VALUES = [
  "googleai/gemini-2.5-flash",
  "googleai/gemini-1.5-flash",
  "googleai/gemini-1.5-pro",
] as const;

export type GeminiModelValue = (typeof GEMINI_MODEL_VALUES)[number];

export const GEMINI_MODEL_OPTIONS: { value: GeminiModelValue; label: string }[] = [
  { value: "googleai/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "googleai/gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "googleai/gemini-1.5-pro", label: "Gemini 1.5 Pro" },
];
