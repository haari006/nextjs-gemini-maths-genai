"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RichAnswerEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
};

const TOOLBAR_ACTIONS: { label: string; command: string }[] = [
  { label: "Bold", command: "bold" },
  { label: "Italic", command: "italic" },
  { label: "Underline", command: "underline" },
  { label: "Bullets", command: "insertUnorderedList" },
];

export function RichAnswerEditor({ value, onChange, placeholder, className }: RichAnswerEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML === value) return;
    editorRef.current.innerHTML = value;
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  };

  const applyFormat = (command: string) => {
    if (typeof document === "undefined") return;
    document.execCommand(command);
    editorRef.current?.focus();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        {TOOLBAR_ACTIONS.map((action) => (
          <Button
            key={action.command}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyFormat(action.command)}
            className="rounded-full border-border/60 bg-white px-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            {action.label}
          </Button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[180px] w-full rounded-2xl border border-border/60 bg-white p-4 text-base text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        data-placeholder={placeholder}
      />
    </div>
  );
}
