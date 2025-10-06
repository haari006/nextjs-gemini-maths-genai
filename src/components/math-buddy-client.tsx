"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, History, Loader2, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { RichAnswerEditor } from "@/components/rich-answer-editor";
import { WorkingCanvas } from "@/components/working-canvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { GenerateMathProblemOutput } from "@/ai/flows/generate-math-problems";
import { loadHistory, saveHistory, StoredQuestionSession } from "@/lib/history-storage";
import { PrimaryMathematicsSyllabus } from "@/lib/syllabus";
import { cn } from "@/lib/utils";
import { MathText } from "./math-text";

const generationSchema = z.object({
  primary: z.string({ required_error: "Select a level." }),
  topic: z.string({ required_error: "Select a topic." }),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

type PrimaryLevel = keyof typeof PrimaryMathematicsSyllabus;

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stripHtml(input: string) {
  return input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function toPlainText(input: string) {
  return stripHtml(input).replace(/\s+/g, " ").trim();
}

function parseNumericAnswer(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const fractionMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }

  const percentMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
  if (percentMatch) {
    const numeric = parseFloat(percentMatch[1]);
    if (!Number.isNaN(numeric)) {
      return numeric / 100;
    }
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function answersMatch(correctAnswer: string, studentAnswer: string) {
  const plainCorrect = toPlainText(correctAnswer).toLowerCase();
  const plainStudent = toPlainText(studentAnswer).toLowerCase();

  const numericCorrect = parseNumericAnswer(plainCorrect);
  const numericStudent = parseNumericAnswer(plainStudent);

  if (numericCorrect !== null && numericStudent !== null) {
    return Math.abs(numericCorrect - numericStudent) < 0.001;
  }

  return plainCorrect === plainStudent;
}

function summarizeProblem(problem: string) {
  return problem.replace(/\$[^$]*\$/g, " ").replace(/\s+/g, " ").trim();
}

export default function MathBuddyClient() {
  const { toast } = useToast();
  const generationForm = useForm<z.infer<typeof generationSchema>>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      primary: "Primary5",
      difficulty: "easy",
      topic: "",
    },
  });

  const [topics, setTopics] = useState<string[]>([]);
  const [mode, setMode] = useState<"form" | "question">("form");
  const [history, setHistory] = useState<StoredQuestionSession[]>([]);
  const historyHydrated = useRef(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSession = useMemo(
    () => history.find((entry) => entry.id === currentSessionId) ?? null,
    [history, currentSessionId]
  );
  const [answerHtml, setAnswerHtml] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isGeneratingSimilar, setIsGeneratingSimilar] = useState(false);

  const formatTopicLabel = useCallback((topic: string) => {
    return topic.replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
  }, []);

  const allPrimaryLevels = useMemo(() => Object.keys(PrimaryMathematicsSyllabus) as PrimaryLevel[], []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = loadHistory();
    setHistory(stored);
    historyHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!historyHydrated.current) return;
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    if (!currentSession) {
      setAnswerHtml("");
      setHint(null);
      setFeedback(null);
      setHasChecked(false);
      return;
    }

    setAnswerHtml(currentSession.userAnswerHtml ?? "");
    setHint(currentSession.hint ?? null);
    setFeedback(currentSession.feedback ?? null);
    setHasChecked(Boolean(currentSession.feedback));
  }, [currentSession]);

  const updateTopics = useCallback(
    (level: PrimaryLevel, resetTopic = true) => {
      const syllabus = PrimaryMathematicsSyllabus[level] as Record<string, Record<string, unknown>>;
      const collectedTopics = Object.values(syllabus ?? {}).flatMap((section) => Object.keys(section ?? {}));
      setTopics(collectedTopics);
      if (resetTopic) {
        generationForm.setValue("topic", collectedTopics[0] ?? "");
      } else if (!generationForm.getValues("topic") && collectedTopics.length > 0) {
        generationForm.setValue("topic", collectedTopics[0]);
      }
    },
    [generationForm]
  );

  useEffect(() => {
    const defaultPrimary = generationForm.getValues("primary") as PrimaryLevel;
    if (!defaultPrimary) return;
    updateTopics(defaultPrimary, false);
  }, [generationForm, updateTopics]);

  const handlePrimaryLevelChange = useCallback(
    (value: string) => {
      const level = value as PrimaryLevel;
      generationForm.setValue("primary", level);
      updateTopics(level);
    },
    [generationForm, updateTopics]
  );

  const fetchProblem = useCallback(
    async (values: z.infer<typeof generationSchema>) => {
      const response = await fetch("/api/generate-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to create a question.");
      }

      const generated: GenerateMathProblemOutput = await response.json();
      return generated;
    },
    []
  );

  const startSession = useCallback(
    (generated: GenerateMathProblemOutput, values: z.infer<typeof generationSchema>) => {
      const session: StoredQuestionSession = {
        id: createSessionId(),
        createdAt: new Date().toISOString(),
        config: values,
        problem: generated.problem,
        answer: generated.answer,
        working: generated.working,
      };

      setHistory((previous) => [session, ...previous]);
      setCurrentSessionId(session.id);
      setMode("question");
    },
    []
  );

  const onGenerate = generationForm.handleSubmit(async (values) => {
    try {
      setIsGenerating(true);
      const generated = await fetchProblem(values);
      startSession(generated, values);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: error?.message || "Please try generating a question again.",
      });
    } finally {
      setIsGenerating(false);
    }
  });

  const handleCheckAnswer = async () => {
    if (!currentSession) return;
    const answerText = toPlainText(answerHtml);

    if (!answerText) {
      toast({
        variant: "destructive",
        title: "Add your answer",
        description: "Type your working or final answer before checking.",
      });
      return;
    }

    try {
      setIsChecking(true);
      const response = await fetch("/api/provide-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: currentSession.problem,
          studentAnswer: answerText,
          correctAnswer: currentSession.answer,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to check the answer right now.");
      }

      const { feedback: feedbackText } = await response.json();
      const correct = answersMatch(currentSession.answer, answerText);

      setFeedback(feedbackText);
      setHasChecked(true);

      setHistory((entries) =>
        entries.map((entry) =>
          entry.id === currentSession.id
            ? {
                ...entry,
                userAnswerHtml: answerHtml,
                userAnswerText: answerText,
                feedback: feedbackText,
                isCorrect: correct,
              }
            : entry
        )
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unable to check answer",
        description: error?.message || "Please try again in a moment.",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleRequestHint = async () => {
    if (!currentSession) return;

    try {
      setIsHintLoading(true);
      const response = await fetch("/api/provide-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: currentSession.problem,
          working: currentSession.working,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to fetch a hint right now.");
      }

      const { hint: hintText } = await response.json();
      setHint(hintText);
      setHistory((entries) =>
        entries.map((entry) => (entry.id === currentSession.id ? { ...entry, hint: hintText } : entry))
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unable to fetch hint",
        description: error?.message || "Please try again in a moment.",
      });
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleReset = () => {
    setMode("form");
    if (currentSession) {
      generationForm.reset(currentSession.config);
      updateTopics(currentSession.config.primary as PrimaryLevel, false);
    }
    setCurrentSessionId(null);
  };

  const handleGenerateSimilar = async () => {
    if (!currentSession) return;

    try {
      setIsGeneratingSimilar(true);
      const generated = await fetchProblem(currentSession.config);
      startSession(generated, currentSession.config);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unable to create a similar question",
        description: error?.message || "Please try again.",
      });
    } finally {
      setIsGeneratingSimilar(false);
    }
  };

  const hasHistory = history.length > 0;

  return (
    <div className="space-y-8">
      {(mode === "form" || !currentSession) && (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              Build a custom maths question
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Choose your syllabus focus, level, and tone before you generate a challenge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...generationForm}>
              <form onSubmit={onGenerate} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={generationForm.control}
                    name="primary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Level</FormLabel>
                        <Select onValueChange={handlePrimaryLevelChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger aria-label="Select level">
                              <SelectValue placeholder="Select a level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allPrimaryLevels.map((level) => (
                              <SelectItem key={level} value={level}>
                                {level.replace(/([0-9]+)/, " $1")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={generationForm.control}
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger aria-label="Select difficulty">
                              <SelectValue placeholder="Choose difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={generationForm.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger aria-label="Select topic">
                            <SelectValue placeholder="Select a topic" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {topics.map((topic) => (
                            <SelectItem key={topic} value={topic}>
                              {formatTopicLabel(topic)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full sm:w-auto" disabled={isGenerating}>
                  {isGenerating ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Generating
                    </span>
                  ) : (
                    "Generate question"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {mode === "question" && currentSession && (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">Your generated question</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {`Level ${currentSession.config.primary.replace(/([0-9]+)/, " $1")}`} · {formatTopicLabel(currentSession.config.topic)} ·
              {` ${currentSession.config.difficulty.charAt(0).toUpperCase()}${currentSession.config.difficulty.slice(1)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-base text-foreground">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
              <MathText text={currentSession.problem} />
            </div>
            <div className="space-y-4">
              <RichAnswerEditor
                value={answerHtml}
                onChange={setAnswerHtml}
                placeholder="Type your steps, highlight key working, or paste your final answer here."
              />
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={handleCheckAnswer} disabled={isChecking}>
                  {isChecking ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking
                    </span>
                  ) : (
                    "Check answer"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRequestHint}
                  disabled={isHintLoading}
                  className="border-border/60"
                >
                  {isHintLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Thinking
                    </span>
                  ) : (
                    "Need a hint?"
                  )}
                </Button>
              </div>
              {hint && (
                <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-primary">
                  {hint}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {hasChecked && currentSession && feedback && (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              {currentSession.isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" aria-hidden />
              )}
              <CardTitle className="text-lg font-semibold text-foreground">Feedback</CardTitle>
            </div>
            <CardDescription className="text-sm text-muted-foreground">
              {currentSession.isCorrect ? "Great job!" : "Here's how you can improve your approach next time."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-sm text-foreground/90">{feedback}</p>
            {currentSession.working.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Answer working (auto-rendered)</h3>
                <WorkingCanvas working={currentSession.working} />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleGenerateSimilar} disabled={isGeneratingSimilar}>
              {isGeneratingSimilar ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Re-rolling
                </span>
              ) : (
                "Generate similar question"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={handleReset} className="border-border/60">
              Reset to question builder
            </Button>
          </CardFooter>
        </Card>
      )}

      {hasHistory && (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <History className="h-5 w-5 text-muted-foreground" aria-hidden /> Past questions
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Tap to revisit full working and your submissions.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/question/${entry.id}`}
                  className={cn(
                    "group block rounded-2xl border border-border/50 bg-white/90 p-4 shadow-sm transition hover:border-primary/40 hover:bg-primary/5",
                    currentSessionId === entry.id && "border-primary/50"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border border-border/60 px-3 py-1 text-[11px] font-semibold",
                        entry.isCorrect === undefined
                          ? "bg-muted/40 text-muted-foreground"
                          : entry.isCorrect
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      )}
                    >
                      {entry.isCorrect === undefined
                        ? "Awaiting check"
                        : entry.isCorrect
                        ? "Correct"
                        : "Review again"}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground/90">{summarizeProblem(entry.problem)}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
