"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type RichAnswerEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichAnswerEditor({ value, onChange, placeholder, className }: RichAnswerEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cn(
        "min-h-[200px] resize-y rounded-2xl border-border/60 bg-white px-4 py-3 text-base text-foreground shadow-sm focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
        className
      )}
    />
  );
}
