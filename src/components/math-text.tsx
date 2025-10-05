"use client";
import React from 'react';
import { InlineMath } from 'react-katex';

interface MathTextProps {
  text: string;
}

export const MathText: React.FC<MathTextProps> = ({ text }) => {
  const parts = text.split(/(\$[^$]+\$)/);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          // It's a math part
          return <InlineMath key={index} math={part.slice(1, -1)} />;
        }
        // It's a regular text part
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};
