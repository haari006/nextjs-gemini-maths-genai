"use client";

import Link from "next/link";

import MathBuddyClient from "@/components/math-buddy-client";

export default function QuestionsWorkspace() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/dashboard" className="rounded-full border border-border/50 px-3 py-1 transition hover:border-primary/40 hover:text-primary">
              ← Back to dashboard
            </Link>
          </li>
          <li className="hidden text-xs text-border sm:block">/</li>
          <li className="font-medium text-foreground">Question Lab</li>
        </ol>
      </nav>
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-headline text-foreground sm:text-4xl">Question Lab</h1>
        <p className="text-base text-muted-foreground">
          Keep things simple. Pick your options, generate a fresh prompt, and share it instantly.
        </p>
      </div>
      <MathBuddyClient />
    </div>
  );
}
