"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, DocumentDto } from "@/lib/api";

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "destructive"> = {
  ready: "outline",
  processing: "secondary",
  error: "destructive",
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);

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
                <TableCell>{doc._count?.chunks ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(doc.uploadedAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => remove(doc.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
