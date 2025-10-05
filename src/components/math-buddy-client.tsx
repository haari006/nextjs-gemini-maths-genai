"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  BrainCircuit,
  CheckCircle2,
  HelpCircle,
  History,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

import type { GenerateMathProblemOutput } from "@/ai/flows/generate-math-problems";
import { supabase } from "@/lib/supabase-client";
import { PrimaryMathematicsSyllabus } from "@/lib/syllabus";
import { MathText } from "./math-text";

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
type Score = { correct: number; total: number };
type ProblemHistory = {
  id: string;
  created_at: string;
  problem_text: string;
  submissions: {
    user_answer: number;
    is_correct: boolean;
  }[];
}[];

export default function MathBuddyClient() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [problem, setProblem] = useState<GenerateMathProblemOutput | null>(
    null
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    text: string | null;
  } | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState<Score>({ correct: 0, total: 0 });
  const [history, setHistory] = useState<ProblemHistory>([]);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showHintDialog, setShowHintDialog] = useState(false);
  const [isFetchingHint, setIsFetchingHint] = useState(false);
  const [lastSettings, setLastSettings] = useState<
    z.infer<typeof generationSchema> | null
  >(null);
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

  const friendlyPrimary = lastSettings
    ? lastSettings.primary.replace("Primary", "Primary ")
    : null;
  const friendlyTopic = lastSettings?.topic
    ? formatTopicLabel(lastSettings.topic)
    : null;
  const friendlyDifficulty = lastSettings?.difficulty
    ? `${lastSettings.difficulty.charAt(0).toUpperCase()}${lastSettings.difficulty.slice(1)}`
    : null;
  const stateDescriptor = {
    idle: "Pick your next math adventure",
    generating: "Summoning a puzzle just for you",
    solving: "Solve the quest",
    checking: "Checking your clever answer",
    feedback: "Let’s see how you did",
  }[gameState];

  const generationForm = useForm<z.infer<typeof generationSchema>>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      difficulty: "easy",
    },
  });

  const answerForm = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
  });

  const fetchScoreAndHistory = useCallback(async () => {
    const { data: submissions, error: submissionsError } = await supabase
      .from("math_problem_submissions")
      .select("is_correct");

    if (submissionsError) {
      console.error("Error fetching score:", submissionsError);
    } else {
      const correct = submissions.filter((s) => s.is_correct).length;
      const total = submissions.length;
      setScore({ correct, total });
    }

    const { data: historyData, error: historyError } = await supabase
      .from("math_problem_sessions")
      .select(
        `
            id,
            created_at,
            problem_text,
            submissions:math_problem_submissions (
                user_answer,
                is_correct
            )
        `
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (historyError) {
      console.error("Error fetching history:", historyError);
    } else {
      setHistory(historyData as ProblemHistory);
    }
  }, []);

  const formatTopicLabel = useCallback((topic: string) => {
    return topic.replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
  }, []);

  const handlePrimaryLevelChange = useCallback(
    (value: string) => {
      const level = value as PrimaryLevel;
      if (level && PrimaryMathematicsSyllabus[level]) {
        const syllabus = PrimaryMathematicsSyllabus[level] as Record<
          string,
          Record<string, unknown>
        >;
        // Collect topic groups across all sections (e.g., NumberAndAlgebra, MeasurementAndGeometry, Statistics)
        const allTopics = Object.values(syllabus).flatMap((section) =>
          Object.keys(section ?? {})
        );
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
    fetchScoreAndHistory();
  }, [handlePrimaryLevelChange, fetchScoreAndHistory]);

  const handleGenerateProblem = async (
    values: z.infer<typeof generationSchema>
  ) => {
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
        description:
          error.message ||
          "Could not generate a new problem. Please try again.",
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
      // Fallback to simple feedback if AI fails
      const fallbackFeedback = isCorrect
        ? "Well done! That's the correct answer."
        : "That's not quite right. Have another look at the problem and try again!";
      setFeedback({ isCorrect, text: fallbackFeedback });
    } finally {
      setGameState("feedback");
      fetchScoreAndHistory(); // Update score and history after submission
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
      setHint(
        "Sorry, I couldn't think of a hint right now. Please try again in a moment."
      );
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

  const renderContent = () => {
    switch (gameState) {
      case "generating":
      case "checking":
        return (
          <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-primary/30 bg-white/80 p-10 text-center shadow-lg backdrop-blur-xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary via-accent to-[#ffc15e] text-white shadow-xl">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <div className="mt-6 space-y-2">
              <p className="font-headline text-2xl text-primary">
                {gameState === "generating"
                  ? "Crafting your challenge..."
                  : "Double-checking your answer..."}
              </p>
              <p className="text-base text-muted-foreground">
                {gameState === "generating"
                  ? "Our math makers are cooking up a fresh puzzle just for you."
                  : "Hang tight while we see how your answer stacks up!"}
              </p>
            </div>
          </div>
        );

      case "solving":
      case "feedback":
        return (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Card className="relative overflow-hidden rounded-[2.2rem] border-none bg-white/85 shadow-xl backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
              <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
              <CardHeader className="relative z-10 space-y-4 rounded-t-[2.2rem] bg-gradient-to-br from-primary via-[#8363ff] to-accent p-8 text-primary-foreground">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge className="rounded-full bg-white/25 px-4 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                    {gameState === "solving" ? "Time to solve!" : "Feedback time"}
                  </Badge>
                  {friendlyDifficulty && (
                    <Badge className="rounded-full bg-white/25 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                      {friendlyDifficulty} level
                    </Badge>
                  )}
                </div>
                <CardTitle className="font-headline text-3xl leading-tight">
                  Math Quest
                </CardTitle>
                <CardDescription className="text-base text-primary-foreground/85">
                  {friendlyTopic
                    ? `Focus: ${friendlyTopic}`
                    : "Let’s flex those brain muscles!"}
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6 p-8">
                <div className="rounded-2xl border border-dashed border-primary/30 bg-white/70 p-6 text-base leading-relaxed shadow-inner backdrop-blur-sm">
                  {problem?.problem && <MathText text={problem.problem} />}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {friendlyPrimary && (
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/40 bg-primary/10 px-4 py-1 text-primary"
                    >
                      {friendlyPrimary}
                    </Badge>
                  )}
                  {friendlyTopic && (
                    <Badge
                      variant="outline"
                      className="rounded-full border-accent/40 bg-accent/10 px-4 py-1 text-accent-foreground"
                    >
                      {friendlyTopic}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-6">
              <Form {...answerForm}>
                <form
                  onSubmit={answerForm.handleSubmit(handleCheckAnswer)}
                  className="space-y-5 rounded-[2rem] border border-transparent bg-white/85 p-6 shadow-xl backdrop-blur-xl"
                >
                  <FormField
                    control={answerForm.control}
                    name="answer"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="flex items-center gap-2 text-lg font-semibold text-primary">
                          <PartyPopper className="h-5 w-5" />
                          Your Answer
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            disabled={gameState !== "solving"}
                            placeholder="Show your working or type your answer..."
                            rows={4}
                            className="min-h-[140px] rounded-2xl border-none bg-white/80 text-base shadow-inner focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    {gameState === "solving" && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="submit"
                          size="lg"
                          className="rounded-full bg-gradient-to-r from-[#7b61ff] via-[#ff6fb7] to-[#ffc15e] px-8 py-5 text-base font-semibold text-white shadow-lg hover:brightness-105"
                        >
                          Check my answer
                        </Button>
                      </motion.div>
                    )}
                    {gameState === "solving" && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleFetchHint}
                          className="rounded-full border-primary/40 bg-primary/10 px-6 py-5 text-primary hover:bg-primary/20"
                        >
                          <Lightbulb className="mr-2 h-5 w-5" />
                          Need a hint?
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </form>
              </Form>
              <AnimatePresence>
                {gameState === "feedback" && feedback && feedback.text && (
                  <motion.div
                    key="feedback-card"
                    initial={{ y: 24, opacity: 0, scale: 0.98 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 12, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 180, damping: 14 }}
                    className="rounded-[2rem] border border-transparent bg-white/85 p-6 shadow-xl backdrop-blur-xl"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full ${
                            feedback.isCorrect
                              ? "bg-primary/20 text-primary"
                              : "bg-destructive/20 text-destructive"
                          }`}
                        >
                          {feedback.isCorrect ? (
                            <CheckCircle2 className="h-7 w-7" />
                          ) : (
                            <XCircle className="h-7 w-7" />
                          )}
                        </div>
                        <div>
                          <h3
                            className={`font-headline text-2xl ${
                              feedback.isCorrect
                                ? "text-primary"
                                : "text-destructive"
                            }`}
                          >
                            {feedback.isCorrect ? "Brilliant work!" : "Almost there!"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {feedback.isCorrect
                              ? "You're on a winning streak. Ready for another challenge?"
                              : "Give it another shot or peek at the answer below."}
                          </p>
                        </div>
                      </div>
                      <p className="text-base leading-relaxed">{feedback.text}</p>
                      <div className="flex flex-wrap gap-2">
                        {!feedback.isCorrect && (
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              onClick={handleTryAgain}
                              className="rounded-full border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                            >
                              Try again
                            </Button>
                          </motion.div>
                        )}
                        {!showAnswer && (
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="secondary"
                              onClick={() => setShowAnswer(true)}
                              className="rounded-full bg-secondary px-6 text-secondary-foreground hover:bg-secondary/80"
                            >
                              Show answer
                            </Button>
                          </motion.div>
                        )}
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            onClick={handleNewProblem}
                            className="rounded-full bg-gradient-to-r from-[#5eead4] to-[#7c5cff] px-6 text-white shadow-lg hover:brightness-110"
                          >
                            New problem
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {showAnswer && problem && (
                  <motion.div
                    key="answer-card"
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 8, opacity: 0 }}
                    className="rounded-[2rem] border border-dashed border-primary/40 bg-white/85 p-6 shadow-xl backdrop-blur-xl"
                  >
                    <h3 className="font-headline text-2xl text-primary">
                      Answer &amp; Working
                    </h3>
                    <p className="mt-4 text-base">
                      <strong>Correct answer:</strong> {problem.answer}
                    </p>
                    <div className="mt-6 space-y-4">
                      {problem.working.map((step) => (
                        <motion.div
                          key={step.step}
                          className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-inner"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <p className="font-semibold text-sm text-primary">
                            Step {step.step}: {step.explanation}
                          </p>
                          <div className="prose prose-sm mt-3 max-w-none overflow-x-auto">
                            <BlockMath math={step.formula} />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );

      case "idle":
      default:
        return (
          <Form {...generationForm}>
            <form
              onSubmit={generationForm.handleSubmit(handleGenerateProblem)}
              className="space-y-6"
            >
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={generationForm.control}
                  name="primary"
                  render={({ field }) => (
                    <FormItem className="space-y-3 rounded-3xl border border-transparent bg-white/85 p-5 shadow-lg backdrop-blur-xl">
                      <FormLabel className="flex items-center gap-2 text-lg font-semibold text-primary">
                        <Trophy className="h-5 w-5" />
                        Primary Level
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handlePrimaryLevelChange(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-14 rounded-2xl border-none bg-white/80 text-base font-semibold shadow-inner focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
                            <SelectValue placeholder="Choose your level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-2xl border-none bg-white/95 shadow-2xl">
                          {Object.keys(PrimaryMathematicsSyllabus).map((level) => (
                            <SelectItem key={level} value={level} className="text-base">
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
                    <FormItem className="space-y-3 rounded-3xl border border-transparent bg-white/85 p-5 shadow-lg backdrop-blur-xl">
                      <FormLabel className="flex items-center gap-2 text-lg font-semibold text-primary">
                        <BrainCircuit className="h-5 w-5" />
                        Topic
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!generationForm.getValues("primary")}
                      >
                        <FormControl>
                          <SelectTrigger className="h-14 rounded-2xl border-none bg-white/80 text-base font-semibold shadow-inner focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:opacity-70">
                            <SelectValue placeholder="Pick a math topic" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-2xl border-none bg-white/95 shadow-2xl">
                          {topics.map((topic) => (
                            <SelectItem key={topic} value={topic} className="text-base">
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

              <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                <FormField
                  control={generationForm.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem className="space-y-3 rounded-3xl border border-transparent bg-white/85 p-5 shadow-lg backdrop-blur-xl">
                      <FormLabel className="flex items-center gap-2 text-lg font-semibold text-primary">
                        <Sparkles className="h-5 w-5" />
                        Difficulty
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-14 rounded-2xl border-none bg-white/80 text-base font-semibold shadow-inner focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
                            <SelectValue placeholder="Choose difficulty" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-2xl border-none bg-white/95 shadow-2xl">
                          <SelectItem value="easy" className="text-base">
                            Easy (Warm-up)
                          </SelectItem>
                          <SelectItem value="medium" className="text-base">
                            Medium (Brain boost)
                          </SelectItem>
                          <SelectItem value="hard" className="text-base">
                            Hard (Boss level!)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-stretch">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full"
                  >
                    <Button
                      type="submit"
                      size="lg"
                      className="h-full w-full rounded-3xl bg-gradient-to-r from-[#7b61ff] via-[#ff6fb7] to-[#ffc15e] text-lg font-semibold text-white shadow-[0_12px_30px_rgba(123,97,255,0.35)] hover:brightness-105"
                    >
                      Start my challenge
                    </Button>
                  </motion.div>
                </div>
              </div>
            </form>
          </Form>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className="w-full max-w-5xl"
    >
      <Card className="relative overflow-hidden border-none bg-white/75 shadow-[0_40px_120px_rgba(123,97,255,0.28)] backdrop-blur-2xl rounded-[2.5rem] sm:rounded-[3rem]">
        <div className="pointer-events-none absolute -left-28 -top-28 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-12 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-[#5eead4]/25 blur-3xl" />
        <AlertDialog open={showHintDialog} onOpenChange={setShowHintDialog}>
          <AlertDialogContent className="rounded-[2rem] border-none bg-white/90 backdrop-blur-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-lg font-semibold text-primary">
                <Lightbulb className="h-5 w-5" /> Here's a Hint
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                {isFetchingHint ? (
                  <div className="flex items-center justify-center gap-3 py-4 text-primary">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Thinking...
                  </div>
                ) : (
                  hint || "Sorry, I'm stumped too!"
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90">
                Got it, thanks!
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
          <SheetContent className="w-full border-none bg-white/85 backdrop-blur-xl sm:max-w-lg">
            <SheetHeader className="space-y-2 text-left">
              <SheetTitle className="font-headline text-2xl text-primary">
                Adventure Log
              </SheetTitle>
              <SheetDescription className="text-base text-muted-foreground">
                Review your previously attempted problems.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-4rem)]">
              <div className="space-y-4 p-4">
                {history.length > 0 ? (
                  history.map((session) => (
                    <Card
                      key={session.id}
                      className="rounded-2xl border-none bg-white/80 shadow-inner backdrop-blur-sm"
                    >
                      <CardHeader className="space-y-1">
                        <CardDescription className="text-sm text-muted-foreground">
                          {new Date(session.created_at).toLocaleString()}
                        </CardDescription>
                        <CardTitle className="text-base font-semibold text-foreground">
                          <MathText text={session.problem_text} />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {session.submissions.length > 0 ? (
                          <ul className="space-y-2 text-sm">
                            {session.submissions.map((sub, i) => (
                              <li key={i} className="flex items-center gap-2">
                                {sub.is_correct ? (
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                                <span className="font-medium">
                                  Your answer: {sub.user_answer}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No answer submitted.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-white/70 p-8 text-center shadow-inner">
                    <HelpCircle className="h-10 w-10 text-primary" />
                    <p className="mt-4 font-semibold text-foreground">No History Yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Generate your first problem to start your history.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <CardHeader className="relative z-10 space-y-6 px-6 pb-6 pt-10 text-center sm:px-10">
          <motion.div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary via-accent to-[#ffc15e] text-white shadow-xl"
            initial={{ rotate: -8, scale: 0.85, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
          >
            <BrainCircuit className="h-11 w-11" />
          </motion.div>
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 160, damping: 20 }}
          >
            <CardTitle className="font-headline text-4xl leading-tight text-foreground">
              Gemini Math Buddy
            </CardTitle>
          </motion.div>
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.16, type: "spring", stiffness: 160, damping: 20 }}
          >
            <CardDescription className="text-base text-muted-foreground">
              Your colourful playground for AI-powered math adventures.
            </CardDescription>
          </motion.div>
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.24, type: "spring", stiffness: 160, damping: 20 }}
          >
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/80 px-5 py-2 text-sm font-semibold text-primary shadow-inner backdrop-blur">
              <Sparkles className="h-4 w-4" />
              {stateDescriptor}
            </div>
          </motion.div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-8 px-6 pb-10 pt-0 sm:px-10">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <motion.div
              key={`solved-${solvedLabel}`}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              className="rounded-2xl bg-gradient-to-br from-primary via-[#9b7bff] to-[#ff73c6] p-5 text-left text-white shadow-lg"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-white/75">
                Solved
              </p>
              <p className="mt-2 text-3xl font-headline">{solvedLabel}</p>
              <p className="text-sm text-white/85">Challenges completed</p>
            </motion.div>
            <motion.div
              key={`streak-${currentStreak}`}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 180, damping: 18 }}
              className="rounded-2xl bg-gradient-to-br from-[#5eead4] via-[#50b4ff] to-[#7b61ff] p-5 text-left text-white shadow-lg"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-white/80">
                Streak
              </p>
              <p className="mt-2 text-3xl font-headline">{currentStreak}</p>
              <p className="text-sm text-white/85">Correct in a row</p>
            </motion.div>
            <motion.div
              key={`accuracy-${successRate}`}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 180, damping: 18 }}
              className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-inner backdrop-blur"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                Accuracy
              </p>
              <p className="mt-2 text-3xl font-headline text-primary">{successRate}%</p>
              <p className="text-sm text-muted-foreground">Overall score</p>
              <Progress value={successRate} className="mt-4 h-3 overflow-hidden rounded-full bg-white/60" />
            </motion.div>
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 180, damping: 18 }}
              className="flex h-full flex-col justify-between rounded-2xl border border-white/60 bg-white/85 p-5 shadow-inner backdrop-blur"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                  Adventure log
                </p>
                <p className="mt-2 text-xl font-semibold text-primary">
                  Revisit your puzzles
                </p>
                <p className="text-sm text-muted-foreground">
                  See every problem and answer you've explored.
                </p>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => setShowHistorySheet(true)}
                  className="mt-4 w-full rounded-full bg-gradient-to-r from-primary to-accent text-sm font-semibold text-white shadow-lg hover:brightness-105"
                >
                  <History className="mr-2 h-4 w-4" /> View history
                </Button>
              </motion.div>
            </motion.div>
          </div>
          {renderContent()}
        </CardContent>
      </Card>
    </motion.div>
  );
}
