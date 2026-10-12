"use client";

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="relative font-mono text-sm leading-relaxed whitespace-pre-wrap">
      <span>{content}</span>
      {isStreaming && (
        <span
          className="inline-block w-2 h-4 ml-0.5 bg-violet-400 rounded-xs animate-pulse align-middle"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
