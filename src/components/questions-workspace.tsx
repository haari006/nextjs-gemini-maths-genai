"use client";

import { useMemo } from "react";

import MathBuddyClient from "@/components/math-buddy-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMathProgress } from "@/hooks/use-math-progress";
import { MathText } from "@/components/math-text";

export default function QuestionsWorkspace() {
  const { score, history, loading, refresh } = useMathProgress();

  const answeredCount = useMemo(
    () =>
      history.reduce(
        (total, session) => total + session.submissions.filter((submission) => submission.user_answer !== null).length,
        0
      ),
    [history]
  );

  const latestCorrect = useMemo(() => {
    return history.find((session) => session.submissions.some((submission) => submission.is_correct));
  }, [history]);

  return (
    <div className="space-y-12">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <Badge variant="outline" className="mx-auto rounded-full border-border/60 bg-white/70 px-4 py-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Question Lab
        </Badge>
        <h1 className="text-4xl font-headline text-foreground sm:text-5xl">Create math challenges with AI</h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Select your syllabus focus, generate a personalised question, and keep track of every answer in one calm workspace.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 xl:flex-row xl:items-start">
        <div className="flex-1 xl:max-w-3xl xl:flex-none">
          <MathBuddyClient score={score} history={history} refreshProgress={refresh} />
        </div>
        <aside className="w-full max-w-xl space-y-6 xl:sticky xl:top-6">
          <Card className="rounded-3xl border border-border/70 bg-white shadow-[0_25px_45px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-semibold text-foreground">Progress snapshot</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Keep an eye on your overall performance while you experiment in the lab.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground/90">Solved</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{score.correct}/{score.total}</p>
                <p className="text-sm text-muted-foreground">Challenges completed</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground/90">Answered</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{answeredCount}</p>
                <p className="text-sm text-muted-foreground">Total submissions</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground/90">Accuracy</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">
                  {score.total ? Math.round((score.correct / score.total) * 100) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Across all sessions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/70 bg-white shadow-[0_25px_45px_rgba(15,23,42,0.08)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-semibold text-foreground">History</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Browse previous prompts and your submitted answers at a glance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[55vh] pr-4">
                <div className="space-y-5">
                  {loading ? (
                    <div className="space-y-3">
                      {[...Array(4)].map((_, index) => (
                        <div key={index} className="h-24 animate-pulse rounded-2xl border border-border/50 bg-muted/20" />
                      ))}
                    </div>
                  ) : history.length > 0 ? (
                    history.map((session) => {
                      const latestSubmission =
                        session.submissions.length > 0
                          ? session.submissions[session.submissions.length - 1]
                          : null;

                      return (
                        <div key={session.id} className="rounded-2xl border border-border/60 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{new Date(session.created_at).toLocaleString()}</span>
                            {latestSubmission ? (
                              <Badge
                                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                                  latestSubmission.is_correct ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"
                                }`}
                                variant="outline"
                              >
                                {latestSubmission.is_correct ? "Correct" : "Review"}
                              </Badge>
                            ) : (
                              <Badge className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] font-semibold text-muted-foreground" variant="outline">
                                Awaiting answer
                              </Badge>
                            )}
                          </div>
                          <Separator className="my-3" />
                          <div className="space-y-3 text-sm text-foreground/90">
                            <MathText text={session.problem_text} />
                            <div className="space-y-2">
                              {session.submissions.length > 0 ? (
                                session.submissions.map((submission, index) => (
                                  <div
                                    key={`${session.id}-${index}`}
                                    className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                                  >
                                    <span className="font-medium text-foreground">Answer: {submission.user_answer}</span>
                                    <Badge
                                      className={`rounded-full border px-2 py-[2px] text-[11px] font-semibold ${
                                        submission.is_correct ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"
                                      }`}
                                      variant="outline"
                                    >
                                      {submission.is_correct ? "Correct" : "Try again"}
                                    </Badge>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">No submissions yet for this question.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
                      <p className="text-base font-semibold text-foreground">No sessions recorded yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">Generate a problem to start building your history.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {latestCorrect && (
            <Card className="rounded-3xl border border-border/70 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.07)]">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl font-semibold text-foreground">Recent win</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  A highlight from your latest correct submission.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-foreground/90">
                <p className="font-medium text-muted-foreground">
                  {new Date(latestCorrect.created_at).toLocaleString()}
                </p>
                <MathText text={latestCorrect.problem_text} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
