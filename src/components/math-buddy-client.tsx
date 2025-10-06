"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { History, Info, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { GenerateMathProblemOutput } from "@/ai/flows/generate-math-problems";
import { PrimaryMathematicsSyllabus } from "@/lib/syllabus";
import { cn } from "@/lib/utils";
import type { MathSessionSummary } from "@/types/math";
import { MathText } from "./math-text";

const generationSchema = z.object({
  primary: z.string({ required_error: "Select a level." }),
  topic: z.string({ required_error: "Select a topic." }),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const defaultGenerationValues: z.infer<typeof generationSchema> = {
  primary: "Primary5",
  topic: "",
  difficulty: "easy",
};

type PrimaryLevel = keyof typeof PrimaryMathematicsSyllabus;

type SessionResponse = {
  session: MathSessionSummary;
};

type SessionsResponse = {
  sessions: MathSessionSummary[];
};

function hasCompleteConfig(config: MathSessionSummary["config"]) {
  return Boolean(config.primary && config.topic && config.difficulty);
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
    defaultValues: defaultGenerationValues,
  });

  const [topics, setTopics] = useState<string[]>([]);
  const [mode, setMode] = useState<"form" | "question">("form");
  const [history, setHistory] = useState<MathSessionSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSession = useMemo(
    () => history.find((entry) => entry.id === currentSessionId) ?? null,
    [history, currentSessionId]
  );
  const [answerValue, setAnswerValue] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isGeneratingSimilar, setIsGeneratingSimilar] = useState(false);
  const feedbackSectionRef = useRef<HTMLDivElement | null>(null);

  const formatTopicLabel = useCallback((topic: string) => {
    return topic.replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
  }, []);

  const allPrimaryLevels = useMemo(() => Object.keys(PrimaryMathematicsSyllabus) as PrimaryLevel[], []);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsHistoryLoading(true);
        const response = await fetch("/api/math-sessions?limit=25");
        if (!response.ok) {
          throw new Error("Unable to load saved sessions.");
        }
        const data: SessionsResponse = await response.json();
        setHistory(data.sessions ?? []);
      } catch (error) {
        console.warn(error);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    void loadHistory();
  }, []);

  useEffect(() => {
    if (!currentSession) {
      setAnswerValue("");
      setHint(null);
      setFeedback(null);
      setHasChecked(false);
      return;
    }

    setMode("question");
    setAnswerValue(currentSession.latestSubmission?.userAnswer ?? "");
    setHint(currentSession.hint ?? null);
    setFeedback(currentSession.latestSubmission?.feedback ?? null);
    setHasChecked(Boolean(currentSession.latestSubmission?.feedback));
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

  const triggerConfetti = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      const module = await import("canvas-confetti");
      const confetti = module.default;
      const burst = () =>
        confetti({
          spread: 70,
          particleCount: 160,
          origin: { y: 0.3 },
          scalar: 0.9,
          colors: ["#2563eb", "#0ea5e9", "#facc15", "#22c55e"],
          disableForReducedMotion: true,
        });
      burst();
      setTimeout(() => {
        confetti({
          spread: 55,
          particleCount: 120,
          origin: { y: 0.4 },
          scalar: 0.75,
          colors: ["#2563eb", "#a855f7", "#fb7185"],
          disableForReducedMotion: true,
        });
      }, 220);
    } catch (error) {
      console.warn("Unable to launch confetti", error);
    }
  }, []);

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

  const createSession = useCallback(
    async (generated: GenerateMathProblemOutput, values: z.infer<typeof generationSchema>) => {
      const response = await fetch("/api/math-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: values,
          problem: generated.problem,
          answer: generated.answer,
          working: generated.working,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to save the generated question.");
      }

      const data: SessionResponse = await response.json();
      return data.session;
    },
    []
  );

  const startSession = useCallback(
    (session: MathSessionSummary, values: z.infer<typeof generationSchema>) => {
      setHistory((previous) => [session, ...previous.filter((entry) => entry.id !== session.id)]);
      setCurrentSessionId(session.id);
      setMode("question");
      setAnswerValue("");
      setHint(session.hint);
      setFeedback(session.latestSubmission?.feedback ?? null);
      setHasChecked(Boolean(session.latestSubmission?.feedback));
      generationForm.reset(values);
    },
    [generationForm]
  );

  const onGenerate = generationForm.handleSubmit(async (values) => {
    try {
      setIsGenerating(true);
      const generated = await fetchProblem(values);
      const session = await createSession(generated, values);
      startSession(session, values);
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
    const plainAnswer = toPlainText(answerValue);

    if (!plainAnswer) {
      toast({
        variant: "destructive",
        title: "Add your answer",
        description: "Type your working or final answer before checking.",
      });
      return;
    }

    if (parseNumericAnswer(plainAnswer) === null) {
      toast({
        variant: "destructive",
        title: "Enter a numeric answer",
        description: "Please provide a number so we can check it.",
      });
      return;
    }

    try {
      setIsChecking(true);
      const response = await fetch(`/api/math-sessions/${currentSession.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: currentSession.problem,
          studentAnswer: answerValue,
          correctAnswer: currentSession.answer,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to check the answer right now.");
      }

      const data: { submission: NonNullable<MathSessionSummary["latestSubmission"]> } = await response.json();

      setFeedback(data.submission.feedback ?? null);
      setHasChecked(true);
      setHistory((entries) =>
        entries.map((entry) =>
          entry.id === currentSession.id
            ? {
                ...entry,
                latestSubmission: data.submission,
              }
            : entry
        )
      );

      if (data.submission.isCorrect || answersMatch(currentSession.answer, plainAnswer)) {
        void triggerConfetti();
      }
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

      void fetch(`/api/math-sessions/${currentSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint: hintText }),
      });
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
      if (hasCompleteConfig(currentSession.config)) {
        const { primary, topic, difficulty } = currentSession.config;
        generationForm.reset({
          primary: primary as string,
          topic: topic as string,
          difficulty: difficulty as "easy" | "medium" | "hard",
        });
        updateTopics(primary as PrimaryLevel, false);
      } else {
        generationForm.reset(defaultGenerationValues);
        updateTopics(defaultGenerationValues.primary as PrimaryLevel, true);
      }
    }
    setCurrentSessionId(null);
    setAnswerValue("");
    setHint(null);
    setFeedback(null);
    setHasChecked(false);
  };

  const handleGenerateSimilar = async () => {
    if (!currentSession) return;

    if (!hasCompleteConfig(currentSession.config)) {
      toast({
        variant: "destructive",
        title: "Options unavailable",
        description: "This saved question doesn't include enough details to recreate it.",
      });
      return;
    }

    try {
      setIsGeneratingSimilar(true);
      const generationConfig = {
        primary: currentSession.config.primary as string,
        topic: currentSession.config.topic as string,
        difficulty: currentSession.config.difficulty as "easy" | "medium" | "hard",
      };
      const generated = await fetchProblem(generationConfig);
      const session = await createSession(generated, generationConfig);
      startSession(session, generationConfig);
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
  const canGenerateSimilar = currentSession ? hasCompleteConfig(currentSession.config) : false;

  useEffect(() => {
    if (!hasChecked || !feedback || !feedbackSectionRef.current) return;
    feedbackSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hasChecked, feedback, currentSession?.id]);

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
                              <SelectValue placeholder="Select a difficulty" />
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
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isGenerating}>
                    {isGenerating ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Generating
                      </span>
                    ) : (
                      "Generate question"
                    )}
                  </Button>
                  {isHistoryLoading && (
                    <p className="text-sm text-muted-foreground">Loading recent history…</p>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {currentSession && (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg font-semibold text-foreground">Generated question</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="rounded-full border px-3 py-1 text-xs font-semibold text-primary">
                {currentSession.config.difficulty.toUpperCase()}
              </Badge>
              <span>
                {`Level ${currentSession.config.primary.replace(/([0-9]+)/, " $1")}`} · {formatTopicLabel(currentSession.config.topic)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-base text-foreground">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
              <MathText text={currentSession.problem} />
            </div>
            <div className="space-y-4">
              <Textarea
                value={answerValue}
                onChange={(event) => setAnswerValue(event.target.value)}
                placeholder="Describe your steps and final answer here."
                rows={6}
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
        <Card ref={feedbackSectionRef} className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" aria-hidden />
              <CardTitle className="text-lg font-semibold text-foreground">Feedback</CardTitle>
            </div>
            <CardDescription className="text-sm text-muted-foreground">
              {currentSession.latestSubmission?.isCorrect
                ? "Great job!"
                : "Here's how you can improve your approach next time."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-sm text-foreground/90">{feedback}</p>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Final answer</p>
              <p className="mt-1 text-base font-semibold text-primary">{currentSession.answer}</p>
            </div>
            {currentSession.working.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Answer working (auto-rendered)</h3>
                <WorkingCanvas working={currentSession.working} finalAnswer={currentSession.answer} />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleGenerateSimilar}
              disabled={isGeneratingSimilar || !canGenerateSimilar}
            >
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
            <Button asChild variant="outline" size="sm" className="border-border/60">
              <Link href="/past-questions">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((entry) => {
                const statusLabel = entry.latestSubmission
                  ? entry.latestSubmission.isCorrect
                    ? "Correct"
                    : "Needs review"
                  : "Awaiting check";
                const statusClass = entry.latestSubmission
                  ? entry.latestSubmission.isCorrect
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border/60 bg-muted/40 text-muted-foreground";
                return (
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
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-xs font-semibold", statusClass)}>
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground/90">
                      {summarizeProblem(entry.problem)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
