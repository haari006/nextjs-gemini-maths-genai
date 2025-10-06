"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useMathProgress } from "@/hooks/use-math-progress";
import { MathText } from "@/components/math-text";

export function DashboardOverview() {
  const { score, history, loading } = useMathProgress();

  const accuracy = useMemo(
    () => (score.total ? Math.round((score.correct / score.total) * 100) : 0),
    [score]
  );

  const streak = useMemo(() => {
    let current = 0;
    for (const session of history) {
      if (!session.submissions.length) break;
      const latest = session.submissions[session.submissions.length - 1];
      if (latest?.is_correct) {
        current += 1;
      } else {
        break;
      }
    }
    return current;
  }, [history]);

  const recentSessions = useMemo(() => history.slice(0, 4), [history]);

  return (
    <div className="space-y-6">
      <div className="rounded-[2.5rem] border border-border/60 bg-white/80 p-8 shadow-[0_30px_90px_rgba(70,86,220,0.18)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3">
            <Badge className="rounded-full bg-primary/10 px-4 py-1 text-primary">Welcome back</Badge>
            <h2 className="font-headline text-4xl text-foreground">Your Maths Command Center</h2>
            <p className="max-w-2xl text-base text-muted-foreground">
              Track progress, celebrate wins, and jump into new problem adventures all from one tidy HQ.
            </p>
          </div>
          <div className="rounded-3xl border border-primary/20 bg-primary/10 p-6 text-center shadow-inner">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-primary/70">Accuracy</p>
            <p className="mt-3 text-5xl font-headline text-primary">{accuracy}%</p>
            <Progress value={accuracy} className="mt-4 h-3 rounded-full bg-primary/20" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl border border-primary/30 bg-primary/10 shadow-inner backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-primary">Challenges solved</CardTitle>
            <CardDescription className="text-sm text-primary/80">
              Total completed problems in Math Buddy.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-4xl font-headline text-primary">
            {score.correct}/{score.total}
          </CardContent>
        </Card>
        <Card className="rounded-3xl border border-accent/30 bg-accent/10 shadow-inner backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-accent">Active streak</CardTitle>
            <CardDescription className="text-sm text-accent/80">
              Consecutive correct answers logged.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-4xl font-headline text-accent">{streak}</CardContent>
        </Card>
        <Card className="rounded-3xl border border-border/50 bg-white/85 shadow-inner backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-primary">Latest performance</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              A quick view of your recent submissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-xl bg-muted/40" />
                ))}
              </div>
            ) : recentSessions.length ? (
              recentSessions.map((session) => {
                const latest =
                  session.submissions.length > 0
                    ? session.submissions[session.submissions.length - 1]
                    : null;
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-xl border border-border/40 bg-white/80 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <Badge
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        latest?.is_correct ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive"
                      }`}
                      variant="outline"
                    >
                      {latest?.is_correct ? "Correct" : "Incorrect"}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet. Start solving challenges to see updates.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border border-border/60 bg-white/85 shadow-[0_20px_60px_rgba(70,86,220,0.12)] backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-primary">Recent adventures</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            A closer look at your latest questions and answers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {recentSessions.length ? (
            recentSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-2xl border border-border/40 bg-white/90 p-4 shadow-inner backdrop-blur"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {new Date(session.created_at).toLocaleString()}
                  </p>
                  <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary" variant="outline">
                    {session.submissions.length} submission{session.submissions.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <MathText text={session.problem_text} />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No questions generated yet. Head to the Question Lab to begin.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
