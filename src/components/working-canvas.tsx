"use client";

import { useEffect, useRef } from "react";

import type { GenerateMathProblemOutput } from "@/ai/flows/generate-math-problems";

function sanitizeFormula(formula: string) {
  return formula
    .replace(/\\\\/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\$+/g, "")
    .replace(/\{\}/g, "")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
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

export function WorkingCanvas({ working }: { working: GenerateMathProblemOutput["working"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const containerWidth = canvas.parentElement?.clientWidth ?? 640;
    const lineHeight = 28;
    const basePadding = 24;
    const maxWidth = containerWidth - basePadding * 2;
    const totalLines = working.reduce((count, step) => {
      const explanationLength = Math.max(step.explanation.length / 45, 1);
      const formulaLength = Math.max(sanitizeFormula(step.formula).length / 35, 1);
      return count + Math.ceil(explanationLength) + Math.ceil(formulaLength) + 1;
    }, 1);
    const height = Math.max(200, totalLines * lineHeight + basePadding * 2);

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

    context.font = "16px 'Nunito', 'Baloo 2', sans-serif";
    context.textBaseline = "top";

    let currentY = basePadding;

    for (const step of working) {
      currentY = wrapText(
        context,
        `Step ${step.step}: ${step.explanation}`,
        basePadding,
        currentY,
        maxWidth,
        lineHeight,
        "#0f172a"
      );

      currentY = wrapText(
        context,
        sanitizeFormula(step.formula),
        basePadding + 16,
        currentY,
        maxWidth,
        lineHeight,
        "#2563eb"
      );

      currentY += lineHeight / 2;
    }
  }, [working]);

  return <canvas ref={canvasRef} className="w-full rounded-2xl border border-border/60 shadow-sm" />;
}
