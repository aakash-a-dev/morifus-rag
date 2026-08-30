"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Eye, Download, Loader2, FileText } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DocumentDto } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "destructive"> = {
  ready: "outline",
  processing: "secondary",
  error: "destructive",
};

const INLINE_RENDERABLE = ["application/pdf", "text/plain", "text/markdown"];

export default function DocumentsPage() {
  const { api } = useWorkspace();
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<DocumentDto | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewTextLoading, setPreviewTextLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setDocs(await api.listDocuments());
    } catch {
      toast.error("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      toast.success("Document deleted.");
    } catch {
      toast.error("Failed to delete document.");
    }
  };

  const openPreview = async (doc: DocumentDto) => {
    setPreviewDoc(doc);
    setPreviewText(null);
    if (doc.status !== "ready") return;
    setPreviewTextLoading(true);
    try {
      const { text } = await api.getDocumentText(doc.id);
      setPreviewText(text);
    } catch {
      setPreviewText(null);
    } finally {
      setPreviewTextLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Document library</h1>
        <p className="mt-1 text-sm text-muted-foreground">All documents uploaded to the workspace.</p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!loading && docs.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}

      {docs.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Chunks</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.filename}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[doc.status]}>{doc.status}</Badge>
                  {doc.status === "error" && doc.errorReason && (
                    <p className="mt-1 text-xs text-muted-foreground">{doc.errorReason}</p>
                  )}
                </TableCell>
                <TableCell>{doc._count?.chunks ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(doc.uploadedAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openPreview(doc)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(doc.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl">
          {previewDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-6">{previewDoc.filename}</DialogTitle>
              </DialogHeader>

              {previewDoc.status !== "ready" ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {previewDoc.status === "processing"
                    ? "Still being processed, preview will be available once ingestion finishes."
                    : "This document failed to process, no preview available."}
                </p>
              ) : (
                <Tabs defaultValue="original">
                  <TabsList>
                    <TabsTrigger value="original">Original file</TabsTrigger>
                    <TabsTrigger value="text">Extracted text</TabsTrigger>
                  </TabsList>

                  <TabsContent value="original">
                    {INLINE_RENDERABLE.includes(previewDoc.mimeType) ? (
                      <iframe
                        src={api.documentFileUrl(previewDoc.id)}
                        className="h-[65vh] w-full rounded-md border border-border"
                        title={previewDoc.filename}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 rounded-md border border-border py-16 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <p className="max-w-xs text-sm text-muted-foreground">
                          This file type can't be previewed inline. Download it to view the original.
                        </p>
                        <Button asChild size="sm" variant="outline">
                          <a href={api.documentFileUrl(previewDoc.id)} download={previewDoc.filename}>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Download original
                          </a>
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="text">
                    {previewTextLoading ? (
                      <div className="flex items-center justify-center py-16 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      <div className="h-[65vh] overflow-y-auto rounded-md border border-border bg-secondary/40 p-4">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {previewText || "No extracted text available."}
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
