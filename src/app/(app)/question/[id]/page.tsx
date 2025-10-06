"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { WorkingCanvas } from "@/components/working-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadHistory, StoredQuestionSession } from "@/lib/history-storage";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/math-text";

function formatTopicLabel(topic: string) {
  return topic.replace(/([A-Z])/g, " $1").replace(/\s+/g, " ").trim();
}

function htmlToPlainText(input: string) {
  return input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(?=\s|$)/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function statusConfig(session: StoredQuestionSession | null) {
  if (!session || session.isCorrect === undefined) {
    return { label: "Awaiting check", className: "border-border/60 bg-muted/40 text-muted-foreground" };
  }

  return session.isCorrect
    ? { label: "Correct", className: "border-primary/30 bg-primary/10 text-primary" }
    : { label: "Review again", className: "border-destructive/30 bg-destructive/10 text-destructive" };
}

export default function QuestionDetailPage() {
  const params = useParams<{ id: string }>();
  const [session, setSession] = useState<StoredQuestionSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const identifier = Array.isArray(params?.id) ? params?.id[0] : params?.id;
    if (!identifier) {
      setSession(null);
      setIsReady(true);
      return;
    }

    const history = loadHistory();
    const found = history.find((entry) => entry.id === identifier) ?? null;
    setSession(found);
    setIsReady(true);
  }, [params?.id]);

  const status = useMemo(() => statusConfig(session), [session]);
  const userAnswer = useMemo(() => {
    if (!session) return "";
    if (session.userAnswerText && session.userAnswerText.trim().length > 0) {
      return session.userAnswerText;
    }
    if (session.userAnswerHtml && session.userAnswerHtml.trim().length > 0) {
      return htmlToPlainText(session.userAnswerHtml);
    }
    return "";
  }, [session]);

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
          <li>
            <Link
              href="/questions"
              className="rounded-full border border-border/50 px-3 py-1 transition hover:border-primary/40 hover:text-primary"
            >
              Question Lab
            </Link>
          </li>
          <li className="text-xs text-border">/</li>
          <li className="font-medium text-foreground">Problem details</li>
        </ol>
      </nav>

      {!isReady ? (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Loading question…</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Fetching your saved session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 animate-pulse rounded-2xl bg-muted/40" />
          </CardContent>
        </Card>
      ) : session ? (
        <>
          <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold text-foreground">Generated question</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className={cn("rounded-full border px-3 py-1 text-xs font-semibold", status.className)}>
                  {status.label}
                </Badge>
                <span>
                  {`Level ${session.config.primary.replace(/([0-9]+)/, " $1")}`} · {formatTopicLabel(session.config.topic)} ·
                  {` ${session.config.difficulty.charAt(0).toUpperCase()}${session.config.difficulty.slice(1)}`}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-5">
                <MathText text={session.problem} />
              </div>
              <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Correct answer</p>
                <p className="mt-1 text-foreground/80">{session.answer}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Your submission</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Captured exactly as you entered it in the Question Lab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userAnswer ? (
                <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border/40 bg-muted/10 p-4 text-sm leading-relaxed text-foreground">
                  {userAnswer}
                </pre>
              ) : session.userAnswerHtml ? (
                <div
                  className="rich-answer max-h-80 overflow-y-auto rounded-2xl border border-border/40 bg-muted/10 p-4 text-sm leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{ __html: session.userAnswerHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  You didn’t submit an answer for this question.
                </p>
              )}
            </CardContent>
          </Card>

          {session.feedback && (
            <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">Coach feedback</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Encouraging notes tailored to your attempt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-sm text-foreground/90">{session.feedback}</p>
              </CardContent>
            </Card>
          )}

          {session.hint && (
            <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">Hint provided</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-primary">{session.hint}</p>
              </CardContent>
            </Card>
          )}

          {session.working.length > 0 && (
            <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">Answer working</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Automatically rendered on the canvas for easy sharing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkingCanvas working={session.working} />
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/questions">Generate another question</Link>
            </Button>
            <Button asChild variant="outline" className="border-border/60">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </>
      ) : (
        <Card className="rounded-2xl border border-border/60 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Question not found</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              We couldn’t locate that saved session. It may have been cleared from your browser storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/questions">Return to Question Lab</Link>
            </Button>
            <Button asChild variant="outline" className="border-border/60">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
