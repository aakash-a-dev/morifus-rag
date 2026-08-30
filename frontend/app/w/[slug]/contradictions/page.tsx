"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useWorkspace } from "@/lib/workspace-context";

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
};

export default function ContradictionsPage() {
  const { api } = useWorkspace();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState("open");
  const [loading, setLoading] = useState(true);

  const load = async (status?: string) => {
    setLoading(true);
    try {
      const data = await api.listContradictions(status === "all" ? undefined : status);
      setItems(data);
    } catch {
      toast.error("Failed to load contradictions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const updateStatus = async (id: string, status: "resolved" | "false_positive") => {
    try {
      await api.updateContradictionStatus(id, status);
      toast.success(status === "resolved" ? "Marked as resolved." : "Marked as false positive.");
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error("Failed to update status.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contradictions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conflicting statements detected across your documents during chat queries.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="false_positive">False positives</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No contradictions here yet. Ask a question in Chat to trigger detection across relevant chunks.
            </p>
          )}
          {items.map((c) => (
            <ContradictionCard key={c.id} contradiction={c} onUpdate={updateStatus} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContradictionCard({ contradiction, onUpdate }: { contradiction: any; onUpdate: (id: string, status: "resolved" | "false_positive") => void }) {
  const c = contradiction;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={SEVERITY_VARIANT[c.severity] ?? "outline"}>{c.severity}</Badge>
          <Badge variant="outline">{c.type}</Badge>
        </div>
        {c.status === "open" && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onUpdate(c.id, "false_positive")}>
              False positive
            </Button>
            <Button size="sm" onClick={() => onUpdate(c.id, "resolved")}>
              Mark resolved
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatementBlock label="Source A" filename={c.chunkA?.document?.filename} page={c.chunkA?.page} text={c.statementA} />
          <StatementBlock label="Source B" filename={c.chunkB?.document?.filename} page={c.chunkB?.page} text={c.statementB} />
        </div>

        <CardTitle className="sr-only">Reasoning</CardTitle>
        <p className="text-sm text-muted-foreground">{c.reasoning}</p>

        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3 w-3" /> Evidence trace
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-md bg-secondary/60 p-3 text-xs">
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(c.reasoningTrace, null, 2)}</pre>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function StatementBlock({ label, filename, page, text }: { label: string; filename?: string; page?: number | null; text: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {label} — {filename ?? "unknown"}
        {page ? ` p.${page}` : ""}
      </p>
      <p className="mt-1 text-sm">"{text}"</p>
    </div>
  );
}
