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
  Sparkles,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
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
  const { toast } = useToast();

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
          <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-semibold text-muted-foreground">
              {gameState === "generating"
                ? "Creating a new problem..."
                : "Checking your answer..."}
            </p>
          </div>
        );

      case "solving":
      case "feedback":
        return (
          <div className="space-y-6">
            <Card className="bg-background/50">
              <CardHeader>
                <CardTitle className="font-headline text-xl">
                  The Problem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-base leading-relaxed">
                  {problem?.problem && <MathText text={problem.problem} />}
                </div>
              </CardContent>
            </Card>

            <Form {...answerForm}>
              <form
                onSubmit={answerForm.handleSubmit(handleCheckAnswer)}
                className="space-y-4"
              >
                <FormField
                  control={answerForm.control}
                  name="answer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">
                        Your Answer
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          disabled={gameState !== "solving"}
                          placeholder="Type your answer here..."
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-wrap gap-2">
                  {gameState === "solving" && (
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button type="submit" size="lg">
                        Check Answer
                      </Button>
                    </motion.div>
                  )}
                  {gameState === "solving" && (
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleFetchHint}
                      >
                        <Lightbulb className="mr-2 h-4 w-4" />
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
                >
                  <Card
                    className={
                      feedback.isCorrect
                        ? "border-primary/50 bg-primary/10"
                        : "border-destructive/50 bg-destructive/10"
                    }
                  >
                    <CardHeader className="flex-row items-center gap-4 space-y-0">
                      {feedback.isCorrect ? (
                        <CheckCircle2 className="h-8 w-8 text-primary" />
                      ) : (
                        <XCircle className="h-8 w-8 text-destructive" />
                      )}
                      <CardTitle
                        className={`font-headline text-2xl ${
                          feedback.isCorrect
                            ? "text-primary"
                            : "text-destructive"
                        }`}
                      >
                        {feedback.isCorrect ? "Great Job!" : "Not Quite..."}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-base">{feedback.text}</p>
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2">
                      {!feedback.isCorrect && (
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button variant="outline" onClick={handleTryAgain}>
                            Try Again
                          </Button>
                        </motion.div>
                      )}
                      {!showAnswer && (
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            variant="secondary"
                            onClick={() => setShowAnswer(true)}
                          >
                            Show Answer
                          </Button>
                        </motion.div>
                      )}
                      <motion.div
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Button onClick={handleNewProblem}>New Problem</Button>
                      </motion.div>
                    </CardFooter>
                  </Card>
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
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-headline text-xl">
                        Answer & Working
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-base">
                        <strong>Correct Answer:</strong> {problem.answer}
                      </p>
                      <div>
                        <h4 className="font-semibold mb-2">
                          Step-by-step solution:
                        </h4>
                        <div className="space-y-4">
                          {problem.working.map((step) => (
                            <motion.div
                              key={step.step}
                              className="p-4 rounded-md border bg-background/50"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              <p className="font-semibold text-sm mb-2">
                                Step {step.step}: {step.explanation}
                              </p>
                              <div className="prose prose-sm max-w-none overflow-x-auto">
                                <BlockMath math={step.formula} />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case "idle":
      default:
        return (
          <React.Fragment>
            <Form {...generationForm}>
              <form
                onSubmit={generationForm.handleSubmit(handleGenerateProblem)}
                className="space-y-8"
              >
                <FormField
                  control={generationForm.control}
                  name="primary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">
                        Choose a Primary Level
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handlePrimaryLevelChange(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a primary level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.keys(PrimaryMathematicsSyllabus).map(
                            (level) => (
                              <SelectItem key={level} value={level}>
                                {level.replace("Primary", "Primary ")}
                              </SelectItem>
                            )
                          )}
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
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">
                        Choose a Topic
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!generationForm.getValues("primary")}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a math topic" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {topics.map((topic) => (
                            <SelectItem key={topic} value={topic}>
                              {topic.replace(/([A-Z])/g, " $1").trim()}
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
                      <FormLabel className="text-lg font-semibold">
                        Difficulty Level
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
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

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button type="submit" className="w-full" size="lg">
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Problem
                  </Button>
                </motion.div>
              </form>
            </Form>
          </React.Fragment>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className="w-full max-w-2xl"
    >
      <Card className="shadow-2xl">
        <AlertDialog open={showHintDialog} onOpenChange={setShowHintDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lightbulb className="text-primary" /> Here's a Hint
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isFetchingHint ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />{" "}
                    Thinking...
                  </div>
                ) : (
                  hint || "Sorry, I'm stumped too!"
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Got it, thanks!</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
          <SheetContent className="w-full sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Problem History</SheetTitle>
              <SheetDescription>
                Review your previously attempted problems.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-4rem)]">
              <div className="space-y-4 p-4">
                {history.length > 0 ? (
                  history.map((session) => (
                    <Card key={session.id} className="bg-muted/50">
                      <CardHeader>
                        <CardDescription>
                          {new Date(session.created_at).toLocaleString()}
                        </CardDescription>
                        <CardTitle className="text-base font-normal">
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
                                <span>Your answer: {sub.user_answer}</span>
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
                  <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                    <HelpCircle className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-4 font-semibold">No History Yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Generate your first problem to start your history.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
        <CardHeader className="text-center">
          <motion.div
            className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
            initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <BrainCircuit className="h-10 w-10 text-primary" />
          </motion.div>
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            <CardTitle className="font-headline text-4xl">
              ✨ Gemini Math Buddy
            </CardTitle>
          </motion.div>
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
          >
            <CardDescription className="text-base">
              Let’s solve fun math puzzles together!
            </CardDescription>
          </motion.div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-between items-center bg-accent/10 p-3 rounded-lg">
            <motion.div
              key={`${score.correct}-${score.total}`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              className="text-center"
            >
              <p className="text-2xl font-bold">
                {score.correct}/{score.total}
              </p>
              <p className="text-sm text-muted-foreground">Problems Solved</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistorySheet(true)}
              >
                <History className="mr-2 h-4 w-4" />
                View History
              </Button>
            </motion.div>
          </div>
          {renderContent()}
        </CardContent>
      </Card>
    </motion.div>
  );
}
