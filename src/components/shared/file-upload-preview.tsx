"use client";

import * as React from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FileUploadPreviewProps {
  label?: string;
  hint?: string;
  accept?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  className?: string;
  /** Renders the file name and size under the control. */
  preview?: boolean;
}

/**
 * A file picker with a local preview.
 *
 * Nothing is uploaded — the browser holds the object URL only. The prototype
 * makes that explicit so nobody mistakes it for real file storage.
 */
export function FileUploadPreview({
  label = "Attach a document",
  hint,
  accept,
  value,
  onChange,
  className,
  preview = true,
}: FileUploadPreviewProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // The object URL is created for the current file and released when the file
  // changes. Keeping it outside state avoids a setState inside an effect.
  const previewUrl = React.useMemo(() => {
    if (!value) return null;
    return URL.createObjectURL(value);
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onChange(file);
  };

  const clear = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clear}
            aria-label="Remove attachment"
          >
            <X />
          </Button>
        )}
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {preview && value && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {(value.size / 1024).toFixed(1)} KB
              {previewUrl && value.type.startsWith("image/") && (
                <span className="ml-2 text-success">Preview ready</span>
              )}
            </p>
          </div>
          {previewUrl && value.type.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Attachment preview"
              className="size-12 rounded-md border object-cover"
            />
          )}
        </div>
      )}

      {!value && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          <Upload className="size-4" />
          {label}
        </div>
      )}
    </div>
  );
}
