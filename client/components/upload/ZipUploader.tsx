"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileArchive, Loader2, Sparkles } from "lucide-react";

interface ZipUploaderProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  disabled?: boolean;
}

export function ZipUploader({ onUpload, uploading, disabled }: ZipUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please select a .zip archive of a Python codebase.");
      return;
    }
    setError(null);
    await onUpload(file);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading && !disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && !disabled && fileInputRef.current?.click()}
        className={`relative group rounded-2xl p-8 text-center cursor-pointer transition-all border border-dashed ${
          dragging
            ? "border-violet-500 bg-violet-500/10 scale-[1.005] shadow-lg shadow-violet-500/10"
            : "border-border/80 hover:border-violet-500/60 hover:bg-card/60 bg-card/30"
        } ${uploading || disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await handleFile(file);
          }}
          disabled={uploading || disabled}
        />

        <div className="flex flex-col items-center justify-center gap-3.5">
          <div className="size-12 rounded-xl bg-gradient-to-br from-violet-500/10 via-indigo-500/10 to-cyan-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform shadow-xs">
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-violet-400" />
            ) : (
              <UploadCloud className="size-6 text-violet-400" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground flex items-center justify-center gap-1.5">
              <span>{uploading ? "Ingesting Repository Pipeline…" : "Drop Python codebase .zip or browse"}</span>
              {!uploading && <Sparkles className="size-3.5 text-violet-400 opacity-80" />}
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Tree-sitter extracts function and class boundaries while generating a parallel fixed-window baseline for research evaluation.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-muted-foreground">
            <span className="px-2 py-0.5 rounded-md bg-muted/50 border border-border/50">
              .zip only
            </span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-md bg-muted/50 border border-border/50">
              Max 100 MB
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 flex items-center gap-2">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
