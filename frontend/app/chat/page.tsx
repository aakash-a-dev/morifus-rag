"use client";

import { useState } from "react";
import { Send, Loader2, ChevronDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { api, ChatResponse } from "@/lib/api";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
}

const EXAMPLE_QUESTIONS = [
  "How many PTO days are employees entitled to?",
  "What's the expense approval threshold?",
  "Are employees required to work in the office?",
];

export default function ChatPage() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const ask = async (query: string) => {
    if (!query.trim() || loading) return;
    setTurns((prev) => [...prev, { role: "user", content: query }]);
    setInput("");
    setLoading(true);
    try {
      const response = await api.ask(query, conversationId);
      setConversationId(response.conversationId);
      setTurns((prev) => [...prev, { role: "assistant", content: response.answer, response }]);
    } catch (err) {
      setTurns((prev) => [...prev, { role: "assistant", content: "Something went wrong answering that question." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask questions grounded in your uploaded documents.</p>
      </div>

      {turns.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <Button key={q} variant="outline" size="sm" onClick={() => ask(q)}>
                {q}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "self-end max-w-[80%]" : "self-start max-w-[85%]"}>
            {turn.role === "user" ? (
              <div className="rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">{turn.content}</div>
            ) : (
              <AssistantMessage turn={turn} />
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-6 flex items-end gap-2 rounded-lg border border-border bg-card p-2 shadow-subtle"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your documents..."
          className="min-h-[44px] resize-none border-0 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
        />
        <Button type="submit" size="icon" disabled={loading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function AssistantMessage({ turn }: { turn: ChatTurn }) {
  const r = turn.response;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.content}</p>
      </div>

      {r && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ConfidenceBadge confidence={r.confidence} lowContext={r.lowContext} />
            {r.fromCache && <Badge variant="outline">Cached answer</Badge>}
            {r.citations.slice(0, 4).map((c, i) => (
              <HoverCard key={c.chunkId}>
                <HoverCardTrigger asChild>
                  <Badge variant="secondary" className="cursor-default">
                    [{i + 1}] {c.filename}
                    {c.page ? ` p.${c.page}` : ""}
                  </Badge>
                </HoverCardTrigger>
                <HoverCardContent>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {c.filename}
                    {c.section ? ` — ${c.section}` : ""}
                  </p>
                  <p className="text-xs leading-relaxed">{c.excerpt}...</p>
                </HoverCardContent>
              </HoverCard>
            ))}
          </div>

          {r.contradictions.length > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              Found {r.contradictions.length} potential contradiction{r.contradictions.length > 1 ? "s" : ""} related to this
              answer — see the Contradictions dashboard.
            </div>
          )}

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3 w-3" /> How I found this
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1 rounded-md bg-secondary/60 p-3 text-xs">
              {r.trace.retrievedChunks.map((c, i) => (
                <div key={c.chunkId} className="flex justify-between">
                  <span>
                    [{i + 1}] {c.filename}
                  </span>
                  <span className="text-muted-foreground">similarity {c.similarity.toFixed(2)}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence, lowContext }: { confidence: number; lowContext: boolean }) {
  if (lowContext) {
    return <Badge variant="destructive">Limited context ({Math.round(confidence * 100)}%)</Badge>;
  }
  return <Badge variant="outline">Confidence {Math.round(confidence * 100)}%</Badge>;
}
