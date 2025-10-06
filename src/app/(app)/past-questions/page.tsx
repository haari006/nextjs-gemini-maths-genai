"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { MathSessionSummary } from "@/types/math";

const statusFilters = [
  { value: "all", label: "All statuses" },
  { value: "correct", label: "Correct" },
  { value: "incorrect", label: "Needs review" },
  { value: "pending", label: "Awaiting check" },
] as const;

type StatusFilter = (typeof statusFilters)[number]["value"];

type DifficultyFilter = "all" | "easy" | "medium" | "hard";

type SessionsResponse = {
  sessions: MathSessionSummary[];
};

function formatTopicLabel(topic: string) {
  return topic.replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
}

function summarizeProblem(problem: string) {
  return problem.replace(/\$[^$]*\$/g, " ").replace(/\s+/g, " ").trim();
}

function statusBadge(entry: MathSessionSummary) {
  if (!entry.latestSubmission) {
    return { label: "Awaiting check", className: "border-border/60 bg-muted/40 text-muted-foreground" };
  }

  return entry.latestSubmission.isCorrect
    ? { label: "Correct", className: "border-primary/30 bg-primary/10 text-primary" }
    : { label: "Needs review", className: "border-destructive/30 bg-destructive/10 text-destructive" };
}

export default function PastQuestionsPage() {
  const [history, setHistory] = useState<MathSessionSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async (status: StatusFilter, difficulty: DifficultyFilter) => {
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("difficulty", difficulty);
    params.set("limit", "100");

    try {
      setLoading(true);
      const response = await fetch(`/api/math-sessions?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Unable to fetch history");
      }
      const data: SessionsResponse = await response.json();
      setHistory(data.sessions ?? []);
    } catch (error) {
      console.warn(error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory(statusFilter, difficultyFilter);
  }, [statusFilter, difficultyFilter, fetchHistory]);

  const filteredHistory = useMemo(() => history, [history]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href="/dashboard"
              className="rounded-full border border-border/50 px-3 py-1 transition hover:border-primary/40 hover:text-primary"
            >
              Dashboard
            </Link>
          </li>
          <li className="text-xs text-border">/</li>
          <li className="font-medium text-foreground">Past questions</li>
        </ol>
      </nav>

      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-headline text-foreground sm:text-4xl">Past questions</h1>
        <p className="text-base text-muted-foreground">
          Browse every challenge you generated, filter by status, and revisit full working any time.
        </p>
      </div>

      <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Filters</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Narrow the list to the questions you want to review.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground">
              Status
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value: StatusFilter) => setStatusFilter(value)}
              disabled={loading}
            >
              <SelectTrigger id="status-filter" className="border-border/60">
                <SelectValue placeholder="Choose status" />
              </SelectTrigger>
              <SelectContent>
                {statusFilters.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="difficulty-filter" className="text-sm font-medium text-muted-foreground">
              Difficulty
            </label>
            <Select
              value={difficultyFilter}
              onValueChange={(value: DifficultyFilter) => setDifficultyFilter(value)}
              disabled={loading}
            >
              <SelectTrigger id="difficulty-filter" className="border-border/60">
                <SelectValue placeholder="Choose difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All difficulties</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Loading past questions…</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Fetching your saved sessions from Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 animate-pulse rounded-2xl bg-muted/40" />
          </CardContent>
        </Card>
      ) : filteredHistory.length === 0 ? (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">No saved questions</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Adjust your filters or generate a new question to see it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/questions">Generate a question</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((entry) => {
            const status = statusBadge(entry);
            return (
              <Card key={entry.id} className="rounded-2xl border border-border/60 bg-white shadow-sm">
                <CardHeader className="flex flex-wrap items-center gap-3 sm:flex-row sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-foreground">
                      {formatTopicLabel(entry.config.topic)} · {entry.config.difficulty.toUpperCase()}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-xs font-semibold", status.className)}>
                    {status.label}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground/90">{summarizeProblem(entry.problem)}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href={`/question/${entry.id}`}>View details</Link>
                    </Button>
                    <Button asChild variant="outline" className="border-border/60">
                      <Link href="/questions">Generate similar</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
