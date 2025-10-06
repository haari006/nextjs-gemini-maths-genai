"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PrimaryMathematicsSyllabus } from "@/lib/syllabus";
import { MathText } from "./math-text";

const generationSchema = z.object({
  primary: z.string({ required_error: "Select a level." }),
  topic: z.string({ required_error: "Select a topic." }),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

type PrimaryLevel = keyof typeof PrimaryMathematicsSyllabus;

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
  const [problem, setProblem] = useState<GenerateMathProblemOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const formatTopicLabel = useCallback((topic: string) => {
    return topic.replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
  }, []);

  const allPrimaryLevels = useMemo(() => Object.keys(PrimaryMathematicsSyllabus) as PrimaryLevel[], []);

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

  const onGenerate = generationForm.handleSubmit(async (values) => {
    try {
      setIsGenerating(true);
      setProblem(null);

      const response = await fetch("/api/generate-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Unable to create a question.");
      }

      const generated: GenerateMathProblemOutput = await response.json();
      setProblem(generated);
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

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Build a custom maths question</CardTitle>
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
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating
                  </span>
                ) : (
                  "Generate question"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {problem && (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Your generated question</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Share it with your learners or keep iterating with new options above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-base text-foreground">
            <MathText text={problem.problem} />
            {problem.answer && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Answer</p>
                <p className="mt-2 text-foreground/90">{problem.answer}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
