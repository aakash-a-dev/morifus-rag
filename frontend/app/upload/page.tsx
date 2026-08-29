"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api, progressStreamUrl } from "@/lib/api";

interface TrackedFile {
  documentId: string;
  filename: string;
  stage: string;
  progress: number;
  message?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(progressStreamUrl());
    eventSourceRef.current = es;
    es.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      setFiles((prev) =>
        prev.map((f) => (f.documentId === data.documentId ? { ...f, stage: data.stage, progress: data.progress, message: data.message } : f))
      );
    };
    return () => es.close();
  }, []);

  const upload = useCallback(async (fileList: File[]) => {
    setUploading(true);
    try {
      const { documents, errors } = await api.uploadFiles(fileList);
      setFiles((prev) => [
        ...prev,
        ...documents.map((d: any) => ({ documentId: d.id, filename: d.filename, stage: "queued", progress: 5 })),
      ]);
      errors?.forEach((e: any) => toast.error(`${e.filename}: ${e.message}`));
    } catch (err) {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) upload(dropped);
  };

  const handleDemoData = async () => {
    setUploading(true);
    try {
      const { documents } = await api.loadDemoData();
      setFiles((prev) => [
        ...prev,
        ...documents.map((d: any) => ({ documentId: d.id, filename: d.filename, stage: "queued", progress: 5 })),
      ]);
      toast.success("Demo HR policy set loaded — 5 documents queued for processing.");
    } catch {
      toast.error("Could not load demo data.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Upload documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, DOCX, Markdown, or plain text. Documents are chunked, embedded, and indexed automatically.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-16 text-center transition-colors ${
          dragActive ? "border-accent bg-accent/5" : "border-border"
        }`}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">Drag and drop files here, or</p>
        <label>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.md,.txt"
            className="hidden"
            onChange={(e) => e.target.files && upload(Array.from(e.target.files))}
          />
          <Button asChild variant="outline" size="sm">
            <span>Browse files</span>
          </Button>
        </label>
      </div>

      <div className="flex items-center justify-center">
        <Button variant="ghost" size="sm" onClick={handleDemoData} disabled={uploading}>
          Load Demo Data (HR & Policy documents)
        </Button>
      </div>

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing</CardTitle>
            <CardDescription>Real-time ingestion status via server-sent events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map((f) => (
              <div key={f.documentId} className="flex items-center gap-3 rounded-md border border-border p-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{f.filename}</p>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all ${f.stage === "error" ? "bg-destructive" : "bg-accent"}`}
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                </div>
                <StageIcon stage={f.stage} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StageIcon({ stage }: { stage: string }) {
  if (stage === "ready") return <CheckCircle2 className="h-4 w-4 text-foreground" />;
  if (stage === "error") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
}
