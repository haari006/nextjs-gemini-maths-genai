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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <MathBuddyClient score={score} history={history} refreshProgress={refresh} />
      <aside className="space-y-6">
        <Card className="rounded-3xl border border-border/60 bg-white/80 shadow-[0_24px_60px_rgba(70,86,220,0.18)] backdrop-blur-xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-headline text-primary">Progress snapshot</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Keep an eye on your wins and the adventures waiting ahead.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Solved</p>
              <p className="mt-2 text-3xl font-headline text-primary">
                {score.correct}/{score.total}
              </p>
              <p className="text-sm text-primary/80">Challenges completed</p>
            </div>
            <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent/70">Answered</p>
              <p className="mt-2 text-3xl font-headline text-accent">{answeredCount}</p>
              <p className="text-sm text-accent/80">Total submissions</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white/85 p-4 shadow-inner backdrop-blur">
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Accuracy</p>
              <p className="mt-2 text-3xl font-headline text-primary">
                {score.total ? Math.round((score.correct / score.total) * 100) : 0}%
              </p>
              <p className="text-sm text-muted-foreground">Across all sessions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-white/85 shadow-[0_24px_60px_rgba(51,136,170,0.18)] backdrop-blur-xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-headline text-primary">Adventure history</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Browse your previous questions and see how you responded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, index) => (
                      <div
                        key={index}
                        className="h-24 animate-pulse rounded-2xl border border-border/40 bg-white/70 shadow-inner"
                      />
                    ))}
                  </div>
                ) : history.length > 0 ? (
                  history.map((session) => {
                    const latestSubmission =
                      session.submissions.length > 0
                        ? session.submissions[session.submissions.length - 1]
                        : null;

                    return (
                      <div
                        key={session.id}
                        className="rounded-2xl border border-border/50 bg-white/90 p-4 shadow-inner backdrop-blur"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(session.created_at).toLocaleString()}
                            </p>
                          </div>
                          {latestSubmission ? (
                            <Badge
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                latestSubmission.is_correct
                                  ? "bg-primary/15 text-primary"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                              variant="outline"
                            >
                              {latestSubmission.is_correct ? "Correct" : "Incorrect"}
                            </Badge>
                          ) : (
                            <Badge className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent" variant="outline">
                              Awaiting answer
                            </Badge>
                          )}
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-3 text-sm">
                          <MathText text={session.problem_text} />
                          <div className="space-y-2">
                            {session.submissions.length > 0 ? (
                              session.submissions.map((submission, index) => (
                                <div
                                  key={`${session.id}-${index}`}
                                  className="flex items-center justify-between rounded-xl border border-border/40 bg-white/85 px-3 py-2"
                                >
                                  <span className="text-sm font-medium text-foreground">
                                    Answer: {submission.user_answer}
                                  </span>
                                  <Badge
                                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                      submission.is_correct
                                        ? "bg-primary/15 text-primary"
                                        : "bg-destructive/10 text-destructive"
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
                  <div className="rounded-2xl border border-dashed border-primary/20 bg-white/75 p-8 text-center shadow-inner">
                    <p className="text-lg font-semibold text-primary">No adventures logged yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Generate a problem to start your practice history.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {latestCorrect && (
          <Card className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-white to-accent/10 shadow-[0_24px_60px_rgba(70,86,220,0.12)] backdrop-blur-xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-headline text-primary">Recent win</CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                Celebrate a recent correct answer to keep momentum going.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-semibold text-foreground">{new Date(latestCorrect.created_at).toLocaleString()}</p>
              <MathText text={latestCorrect.problem_text} />
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}
