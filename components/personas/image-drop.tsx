"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import { ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageDrop({
  onFile,
  className,
  helpText,
  isUploading,
  children,
}: {
  onFile: (file: File) => void;
  className?: string;
  helpText?: string;
  isUploading?: boolean;
  children?: React.ReactNode;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    multiple: false,
    onDrop: (files) => files[0] && onFile(files[0]),
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 bg-card/20 px-3 py-6 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-all duration-200",
        "hover:border-primary/40 hover:bg-card/50 hover:text-foreground",
        isDragActive && "border-primary bg-primary/5 text-primary",
        isUploading && "pointer-events-none opacity-70",
        className
      )}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <Loader2 className="size-5 animate-spin text-primary" />
      ) : (
        children ?? (
          <>
            <ImagePlus className="size-5 transition-transform group-hover:scale-110" />
            <span>{helpText ?? "Drop or click"}</span>
          </>
        )
      )}
    </div>
  );
}
