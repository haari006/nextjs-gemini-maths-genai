"use client";

import { useCallback, useEffect, useRef } from "react";

import type { GenerateMathProblemOutput } from "@/ai/flows/generate-math-problems";

function latexToReadable(formula: string) {
  return formula
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1 ÷ $2")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\left\(/g, "(")
    .replace(/\\right\)/g, ")")
    .replace(/\\left\[/g, "[")
    .replace(/\\right\]/g, "]")
    .replace(/\\left\{/g, "{")
    .replace(/\\right\}/g, "}")
    .replace(/\\pi/g, "π")
    .replace(/\\geq/g, "≥")
    .replace(/\\leq/g, "≤")
    .replace(/\\approx/g, "≈")
    .replace(/\\%/g, "%")
    .replace(/\\pm/g, "±")
    .replace(/\\_/g, "_")
    .replace(/\\^/g, "^");
}

const superscriptMap: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  "n": "ⁿ",
  "i": "ⁱ",
};

function toSuperscript(value: string) {
  return value
    .split("")
    .map((char) => superscriptMap[char] ?? char)
    .join("");
}

function applyPowers(text: string) {
  return text.replace(/\^(\{([^}]*)\}|(\S+))/g, (_match, group, bracketed, single) => {
    const target = (bracketed ?? single ?? "").replace(/[{}]/g, "");
    return toSuperscript(target);
  });
}

function sanitizeFormula(formula: string) {
  return applyPowers(
    latexToReadable(
      formula
        .replace(/\\\\/g, " ")
        .replace(/\\n/g, " ")
        .replace(/\$+/g, "")
        .replace(/\{\}/g, "")
        .replace(/\\text\{([^}]*)\}/g, "$1")
        .replace(/\s+/g, " ")
        .trim()
    )
  );
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: string
) {
  context.fillStyle = color;
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    context.fillText(line, x, currentY);
    currentY += lineHeight;
  }

  return currentY;
}

function estimateHeight(
  working: GenerateMathProblemOutput["working"],
  maxWidth: number,
  lineHeight: number
) {
  return working.reduce((height, step) => {
    const explanationLength = Math.max(Math.ceil(step.explanation.length / (maxWidth / 10)), 1);
    const formulaLength = Math.max(Math.ceil(sanitizeFormula(step.formula).length / (maxWidth / 12)), 1);
    return height + (explanationLength + formulaLength + 1) * lineHeight;
  }, 0);
}

export function WorkingCanvas({
  working,
  finalAnswer,
}: {
  working: GenerateMathProblemOutput["working"];
  finalAnswer?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderCanvas = useCallback(
    (containerWidth: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      const lineHeight = 28;
      const basePadding = 24;
      const maxWidth = Math.max(containerWidth - basePadding * 2, 260);
      const estimatedContentHeight = estimateHeight(working, maxWidth, lineHeight);
      const height = Math.max(260, estimatedContentHeight + basePadding * 3);

      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = containerWidth * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(devicePixelRatio, devicePixelRatio);
      context.clearRect(0, 0, containerWidth, height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, containerWidth, height);

      context.textBaseline = "top";

      let currentY = basePadding;

      for (const step of working) {
        context.font = "16px 'Nunito', 'Baloo 2', sans-serif";
        currentY = wrapText(
          context,
          `Step ${step.step}: ${step.explanation}`,
          basePadding,
          currentY,
          maxWidth,
          lineHeight,
          "#0f172a"
        );

        const readableFormula = sanitizeFormula(step.formula);
        if (readableFormula) {
          context.font = "18px 'Baloo 2', 'Nunito', sans-serif";
          currentY = wrapText(
            context,
            readableFormula,
            basePadding + 16,
            currentY,
            maxWidth,
            lineHeight,
            "#2563eb"
          );
        }

        currentY += lineHeight / 2;
      }

      if (finalAnswer) {
        currentY += lineHeight;
        context.font = "14px 'Nunito', sans-serif";
        currentY = wrapText(
          context,
          "Final answer:",
          basePadding,
          currentY,
          maxWidth,
          lineHeight,
          "#475569"
        );
        context.font = "20px 'Baloo 2', 'Nunito', sans-serif";
        wrapText(
          context,
          sanitizeFormula(finalAnswer),
          basePadding + 12,
          currentY,
          maxWidth,
          lineHeight,
          "#1d4ed8"
        );
      }
    },
    [working, finalAnswer]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const handleResize = (width: number) => {
      const nextWidth = Math.max(Math.floor(width), 280);
      renderCanvas(nextWidth);
    };

    handleResize(parent.clientWidth);

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === parent) {
            handleResize(entry.contentRect.width);
          }
        }
      });
      observer.observe(parent);
      return () => observer.disconnect();
    }

    const resizeListener = () => handleResize(parent.clientWidth);
    window.addEventListener("resize", resizeListener);
    return () => window.removeEventListener("resize", resizeListener);
  }, [renderCanvas]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-2xl border border-border/60 shadow-sm"
      role="img"
      aria-label="Answer working steps"
    />
  );
}
