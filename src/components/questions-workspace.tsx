"use client";

import MathBuddyClient from "@/components/math-buddy-client";

export default function QuestionsWorkspace() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
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
