"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Lightbulb,
  Loader2,
  PartyPopper,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { BlockMath } from "react-katex";
import * as z from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

import type { GenerateMathProblemOutput } from "@/ai/flows/generate-math-problems";
import { supabase } from "@/lib/supabase-client";
import { PrimaryMathematicsSyllabus } from "@/lib/syllabus";
import { MathText } from "./math-text";
import type { ProblemHistory, Score } from "@/types/math";

const generationSchema = z.object({
  primary: z.string({ required_error: "Please select a primary level." }),
  topic: z.string({ required_error: "Please select a topic." }),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const answerSchema = z.object({
  answer: z.string().min(1, "Please enter an answer."),
});

type GameState = "idle" | "generating" | "solving" | "checking" | "feedback";
type PrimaryLevel = keyof typeof PrimaryMathematicsSyllabus;
type MathBuddyClientProps = {
  score: Score;
  history: ProblemHistory;
  refreshProgress: () => Promise<void>;
};

export default function MathBuddyClient({ score, history, refreshProgress }: MathBuddyClientProps) {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [problem, setProblem] = useState<GenerateMathProblemOutput | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; text: string | null } | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [isFetchingHint, setIsFetchingHint] = useState(false);
  const [lastSettings, setLastSettings] = useState<z.infer<typeof generationSchema> | null>(null);
  const { toast } = useToast();

  const currentStreak = useMemo(() => {
    let streak = 0;
    for (const session of history) {
      if (session.submissions.length === 0) {
        break;
      }
      const latestSubmission = session.submissions[session.submissions.length - 1];
      if (latestSubmission?.is_correct) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [history]);

  const successRate = useMemo(() => {
    if (score.total === 0) return 0;
    return Math.round((score.correct / score.total) * 100);
  }, [score]);

  const solvedLabel = score.total > 0 ? `${score.correct}/${score.total}` : "0";

  const friendlyPrimary = lastSettings ? lastSettings.primary.replace("Primary", "Primary ") : null;
  const friendlyTopic = lastSettings?.topic ? formatTopicLabel(lastSettings.topic) : null;
  const friendlyDifficulty = lastSettings?.difficulty
    ? `${lastSettings.difficulty.charAt(0).toUpperCase()}${lastSettings.difficulty.slice(1)}`
    : null;

  const generationForm = useForm<z.infer<typeof generationSchema>>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      difficulty: "easy",
    },
  });

  const answerForm = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
  });

  const formatTopicLabel = useCallback((topic: string) => {
    return topic.replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
  }, []);

  const handlePrimaryLevelChange = useCallback(
    (value: string) => {
      const level = value as PrimaryLevel;
      if (level && PrimaryMathematicsSyllabus[level]) {
        const syllabus = PrimaryMathematicsSyllabus[level] as Record<string, Record<string, unknown>>;
        const allTopics = Object.values(syllabus).flatMap((section) => Object.keys(section ?? {}));
        setTopics(allTopics);
      } else {
        setTopics([]);
      }
      generationForm.setValue("topic", "");
      generationForm.setValue("primary", value);
    },
    [generationForm]
  );

  useEffect(() => {
    handlePrimaryLevelChange("Primary5");
  }, [handlePrimaryLevelChange]);

  const handleGenerateProblem = async (values: z.infer<typeof generationSchema>) => {
    setGameState("generating");
    setShowAnswer(false);
    setHint(null);
    try {
      const response = await fetch("/api/generate-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate problem.");
      }

      const generated: GenerateMathProblemOutput = await response.json();
      setProblem(generated);
      setLastSettings(values);

      const correctAnswer = parseFloat(generated.answer);
      if (isNaN(correctAnswer)) {
        throw new Error("The generated answer is not a valid number.");
      }

      const { data, error } = await supabase
        .from("math_problem_sessions")
        .insert({
          problem_text: generated.problem,
          correct_answer: correctAnswer,
        })
        .select("id")
        .single();

      if (error) throw error;
      setSessionId(data.id);

      setGameState("solving");
      answerForm.reset();
      setFeedback(null);
    } catch (error: any) {
      console.error("Failed to generate or save problem:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not generate a new problem. Please try again.",
      });
      setGameState("idle");
    }
  };

  const handleCheckAnswer = async (values: z.infer<typeof answerSchema>) => {
    if (!problem || !sessionId) return;
    setGameState("checking");

    const userAnswerStr = values.answer.trim();
    const userAnswerNum = parseFloat(userAnswerStr);

    if (isNaN(userAnswerNum)) {
      toast({
        variant: "destructive",
        title: "Invalid Answer",
        description: "Your answer must be a number.",
      });
      setGameState("solving");
      return;
    }

    const correctAnswerNum = parseFloat(problem.answer);
    const isCorrect = userAnswerNum === correctAnswerNum;

    let feedbackText: string;

    try {
      const feedbackResponse = await fetch("/api/provide-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: problem.problem,
          studentAnswer: userAnswerStr,
          correctAnswer: problem.answer,
        }),
      });

      if (!feedbackResponse.ok) {
        const errorData = await feedbackResponse.json();
        throw new Error(errorData.error || "Failed to get feedback.");
      }

      const feedbackData = await feedbackResponse.json();
      feedbackText = feedbackData.feedback;

      setFeedback({ isCorrect, text: feedbackText });

      const { error } = await supabase.from("math_problem_submissions").insert({
        session_id: sessionId,
        user_answer: userAnswerNum,
        is_correct: isCorrect,
        feedback_text: feedbackText,
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Failed to get feedback or save submission:", error);
      toast({
        variant: "destructive",
        title: "AI Feedback Error",
        description: "Could not get AI-powered feedback. Please try again.",
      });
      const fallbackFeedback = isCorrect
        ? "Well done! That's the correct answer."
        : "That's not quite right. Have another look at the problem and try again!";
      setFeedback({ isCorrect, text: fallbackFeedback });
    } finally {
      setGameState("feedback");
      await refreshProgress();
    }
  };

  const handleFetchHint = async () => {
    if (!problem) return;
    setIsFetchingHint(true);
    setShowHintDialog(true);
    try {
      const response = await fetch("/api/provide-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: problem.problem,
          working: problem.working,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch hint.");
      }
      const hintData = await response.json();
      setHint(hintData.hint);
    } catch (error: any) {
      console.error("Failed to fetch hint:", error);
      setHint("Sorry, I couldn't think of a hint right now. Please try again in a moment.");
    } finally {
      setIsFetchingHint(false);
    }
  };

  const handleTryAgain = () => {
    setGameState("solving");
    answerForm.reset();
    setFeedback(null);
    setShowAnswer(false);
    setHint(null);
  };

  const handleNewProblem = () => {
    setGameState("idle");
    setProblem(null);
    setSessionId(null);
    setFeedback(null);
    setShowAnswer(false);
    setHint(null);
    generationForm.reset({ difficulty: "easy" });
    handlePrimaryLevelChange("Primary5");
    answerForm.reset();
  };

  const latestSession = history[0];

  const renderGeneratingState = () => (
    <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/70 bg-white shadow-[0_10px_20px_rgba(15,23,42,0.06)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">
          {gameState === "generating" ? "Preparing your question" : "Checking your answer"}
        </p>
        <p className="text-sm text-muted-foreground">
          {gameState === "generating"
            ? "Give us a moment to draft a fresh challenge."
            : "We'll confirm your answer in just a second."}
        </p>
      </div>
    </div>
  );

  const renderSolveState = () => (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 p-6">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>Math Buddy</span>
            {friendlyDifficulty && <span>{friendlyDifficulty}</span>}
          </div>
          {friendlyPrimary && (
            <p className="text-xs text-muted-foreground">{friendlyPrimary}{friendlyTopic ? ` • ${friendlyTopic}` : ""}</p>
          )}
          <div className="mt-4 text-base text-foreground">
            {problem?.problem && <MathText text={problem.problem} />}
          </div>
        </div>
        {hint && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800">
            <p className="font-medium">Hint</p>
            <p className="mt-2 leading-relaxed">{hint}</p>
          </div>
        )}
      </div>

      <Form {...answerForm}>
        <form
          onSubmit={answerForm.handleSubmit(handleCheckAnswer)}
          className="space-y-4 rounded-2xl border border-border/70 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
        >
          <FormField
            control={answerForm.control}
            name="answer"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <PartyPopper className="h-4 w-4" /> Your answer
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    disabled={gameState !== "solving"}
                    placeholder="Type your numerical answer here"
                    rows={4}
                    className="rounded-xl border border-border/60 bg-muted/10 text-base focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-wrap items-center gap-3">
            {gameState === "solving" && (
              <Button type="submit" className="rounded-full px-6 py-5 text-sm font-semibold">
                Check answer
              </Button>
            )}
            {gameState === "solving" && (
              <Button type="button" variant="outline" onClick={handleFetchHint} className="rounded-full px-6 py-5 text-sm">
                <Lightbulb className="mr-2 h-4 w-4" /> Ask for a hint
              </Button>
            )}
          </div>
        </form>
      </Form>

      <AnimatePresence>
        {gameState === "feedback" && feedback && feedback.text && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="space-y-4 rounded-2xl border border-border/70 bg-muted/15 p-6"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  feedback.isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {feedback.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </div>
              <div className="space-y-2 text-sm leading-relaxed text-foreground">
                <p className="font-semibold">
                  {feedback.isCorrect ? "Great job!" : "Let's adjust and try again."}
                </p>
                <p>{feedback.text}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {!feedback.isCorrect && (
                <Button variant="outline" onClick={handleTryAgain} className="rounded-full px-5 text-sm">
                  Try again
                </Button>
              )}
              {!showAnswer && (
                <Button variant="secondary" onClick={() => setShowAnswer(true)} className="rounded-full px-5 text-sm">
                  Reveal answer
                </Button>
              )}
              <Button onClick={handleNewProblem} className="rounded-full px-5 text-sm">
                New problem
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAnswer && problem && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-white p-6 shadow-[0_15px_35px_rgba(15,23,42,0.07)]"
          >
            <h3 className="text-lg font-semibold text-foreground">Answer &amp; working</h3>
            <p className="text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">Correct answer:</strong> {problem.answer}
            </p>
            <div className="space-y-3">
              {problem.working.map((step) => (
                <div key={step.step} className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <p className="text-sm font-medium text-foreground">Step {step.step}</p>
                  <p className="text-sm text-muted-foreground">{step.explanation}</p>
                  <div className="prose prose-sm mt-3 max-w-none">
                    <BlockMath math={step.formula} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderIdleState = () => (
    <Form {...generationForm}>
      <form onSubmit={generationForm.handleSubmit(handleGenerateProblem)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={generationForm.control}
            name="primary"
            render={({ field }) => (
              <FormItem className="space-y-3 rounded-2xl border border-border/70 bg-white p-5 shadow-[0_15px_35px_rgba(15,23,42,0.07)]">
                <FormLabel className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Trophy className="h-4 w-4" /> Primary level
                </FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    handlePrimaryLevelChange(value);
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-xl border border-border/60 bg-muted/10 text-sm">
                      <SelectValue placeholder="Choose level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.keys(PrimaryMathematicsSyllabus).map((level) => (
                      <SelectItem key={level} value={level} className="text-sm">
                        {level.replace("Primary", "Primary ")}
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
            name="topic"
            render={({ field }) => (
              <FormItem className="space-y-3 rounded-2xl border border-border/70 bg-white p-5 shadow-[0_15px_35px_rgba(15,23,42,0.07)]">
                <FormLabel className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4" /> Topic
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!generationForm.getValues("primary")}> 
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-xl border border-border/60 bg-muted/10 text-sm disabled:opacity-60">
                      <SelectValue placeholder="Pick a topic" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic} value={topic} className="text-sm">
                        {formatTopicLabel(topic)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <FormField
            control={generationForm.control}
            name="difficulty"
            render={({ field }) => (
              <FormItem className="space-y-3 rounded-2xl border border-border/70 bg-white p-5 shadow-[0_15px_35px_rgba(15,23,42,0.07)]">
                <FormLabel className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4" /> Difficulty
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12 rounded-xl border border-border/60 bg-muted/10 text-sm">
                      <SelectValue placeholder="Choose difficulty" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="easy" className="text-sm">
                      Easy
                    </SelectItem>
                    <SelectItem value="medium" className="text-sm">
                      Medium
                    </SelectItem>
                    <SelectItem value="hard" className="text-sm">
                      Hard
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            size="lg"
            className="h-full rounded-full px-10 text-sm font-semibold shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
          >
            Generate question
          </Button>
        </div>
      </form>
    </Form>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="rounded-[2.5rem] border border-border/70 bg-white shadow-[0_35px_70px_rgba(15,23,42,0.08)]">
        <AlertDialog open={showHintDialog} onOpenChange={setShowHintDialog}>
          <AlertDialogContent className="max-w-lg rounded-2xl border border-border/60 bg-white shadow-[0_25px_45px_rgba(15,23,42,0.08)]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Lightbulb className="h-4 w-4" /> Here's a hint
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {isFetchingHint ? (
                  <div className="flex items-center gap-2 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking of a helpful nudge...
                  </div>
                ) : (
                  hint || ""
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="rounded-full px-6 text-sm">Close</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <CardHeader className="space-y-6 border-b border-border/60 bg-muted/10 p-10 text-center">
          <div className="space-y-3">
            <Badge variant="outline" className="mx-auto rounded-full border-border/60 bg-white px-4 py-1 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Math Buddy
            </Badge>
            <CardTitle className="text-3xl font-headline text-foreground sm:text-4xl">Question Lab</CardTitle>
            <CardDescription className="mx-auto max-w-xl text-base text-muted-foreground">
              A calm space to explore fresh math questions, submit your answers, and learn from AI feedback.
            </CardDescription>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-white/70 p-4 text-left">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Solved</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{solvedLabel}</p>
              <Progress value={score.total ? (score.correct / score.total) * 100 : 0} className="mt-3" />
            </div>
            <div className="rounded-2xl border border-border/60 bg-white/70 p-4 text-left">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Streak</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{currentStreak}</p>
              <p className="mt-3 text-sm text-muted-foreground">Consecutive correct answers</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white/70 p-4 text-left">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Accuracy</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{successRate}%</p>
              <p className="mt-3 text-sm text-muted-foreground">Across all sessions</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-10">
          {gameState === "generating" || gameState === "checking"
            ? renderGeneratingState()
            : gameState === "solving" || gameState === "feedback"
            ? renderSolveState()
            : renderIdleState()}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
          {latestSession ? (
            <p>
              Last activity: {new Date(latestSession.created_at).toLocaleString()} • {latestSession.submissions.length}{" "}
              submission{latestSession.submissions.length === 1 ? "" : "s"}
            </p>
          ) : (
            <p>Start by generating a question to build your learning history.</p>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
