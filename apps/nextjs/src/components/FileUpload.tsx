"use client";

import { useCallback, useRef, useState } from "react";

import { Button } from "@dubai/ui/button";

import type { useTRPCClient } from "~/trpc/react";

type Purpose =
  | "room_photo"
  | "floor_plan"
  | "retailer_document"
  | "product_photo"
  | "ticket_attachment";

interface UploadedFile {
  storageUrl: string;
  key: string;
  filename: string;
}

interface FileEntry {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  result?: UploadedFile;
}

interface FileUploadProps {
  client: ReturnType<typeof useTRPCClient>;
  purpose: Purpose;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  label?: string;
  onUploaded?: (files: UploadedFile[]) => void;
  className?: string;
}

export function FileUpload({
  client,
  purpose,
  multiple = false,
  maxFiles = 10,
  maxSizeMB = 10,
  accept,
  label,
  onUploaded,
  className,
}: FileUploadProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const uploadFile = useCallback(
    async (entry: FileEntry) => {
      const { file } = entry;

      try {
        // Get presigned URL from backend
        const { uploadUrl, key, storageUrl } =
          await client.storage.getUploadUrl.mutate({
            purpose,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
          });

        // Upload via XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setEntries((prev) =>
                prev.map((f) =>
                  f.id === entry.id ? { ...f, progress } : f,
                ),
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.send(file);
        });

        const result: UploadedFile = {
          storageUrl,
          key,
          filename: file.name,
        };

        setEntries((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, status: "done" as const, progress: 100, result }
              : f,
          ),
        );

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        setEntries((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, status: "error" as const, error: message }
              : f,
          ),
        );
        return null;
      }
    },
    [client, purpose],
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      // Validate and create entries
      const currentCount = entries.filter(
        (e) => e.status === "done" || e.status === "uploading",
      ).length;
      const available = maxFiles - currentCount;
      const toProcess = files.slice(0, available);

      const newEntries: FileEntry[] = [];

      for (const file of toProcess) {
        if (file.size > maxSizeBytes) {
          newEntries.push({
            file,
            id: crypto.randomUUID(),
            progress: 0,
            status: "error",
            error: `File exceeds ${maxSizeMB}MB limit`,
          });
          continue;
        }
        newEntries.push({
          file,
          id: crypto.randomUUID(),
          progress: 0,
          status: "uploading",
        });
      }

      setEntries((prev) => [...prev, ...newEntries]);

      // Upload all valid files concurrently
      const uploading = newEntries.filter((e) => e.status === "uploading");
      const results = await Promise.all(uploading.map(uploadFile));
      const successful = results.filter(
        (r): r is UploadedFile => r !== null,
      );

      if (successful.length > 0 && onUploaded) {
        onUploaded(successful);
      }
    },
    [entries, maxFiles, maxSizeBytes, maxSizeMB, uploadFile, onUploaded],
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      void processFiles(Array.from(e.target.files));
      // Reset input so same file can be re-selected
      e.target.value = "";
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      void processFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function retryEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    setEntries((prev) =>
      prev.map((e): FileEntry =>
        e.id === id
          ? { file: e.file, id: e.id, progress: 0, status: "uploading" }
          : e,
      ),
    );

    const result = await uploadFile(entry);
    if (result && onUploaded) {
      onUploaded([result]);
    }
  }

  const defaultLabel = multiple
    ? "Drop files here or click to browse"
    : "Drop a file here or click to browse";

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-foreground/50 bg-accent"
            : "border-input bg-background hover:border-foreground/30"
        }`}
      >
        <div className="text-muted-foreground space-y-1">
          <p className="text-sm font-medium">{label ?? defaultLabel}</p>
          <p className="text-xs">
            Max {maxSizeMB}MB per file
            {multiple ? ` | Up to ${maxFiles} files` : ""}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
          capture="environment"
        />
      </div>

      {/* File entries */}
      {entries.length > 0 && (
        <div className="mt-3 space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-card flex items-center gap-3 rounded-md border p-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entry.file.name}</p>

                {entry.status === "uploading" && (
                  <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full transition-all"
                      style={{ width: `${entry.progress}%` }}
                    />
                  </div>
                )}

                {entry.status === "done" && (
                  <p className="text-xs text-[var(--color-success-default,#22c55e)]">
                    Uploaded
                  </p>
                )}

                {entry.status === "error" && (
                  <p className="text-destructive text-xs">
                    {entry.error}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {entry.status === "error" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void retryEntry(entry.id)}
                  >
                    Retry
                  </Button>
                )}
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="text-muted-foreground hover:text-foreground rounded p-1 text-xs"
                  aria-label="Remove"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
