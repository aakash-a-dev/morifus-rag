"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, ChevronDown, AlertTriangle, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChatResponse } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  response?: ChatResponse;
  failed?: boolean;
}

const EXAMPLE_QUESTIONS = [
  "How many PTO days are employees entitled to?",
  "What's the expense approval threshold?",
  "Are employees required to work in the office?",
];

export default function ChatPage() {
  const { api } = useWorkspace();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  const ask = async (query: string) => {
    if (!query.trim() || loading) return;
    setTurns((prev) => [...prev, { role: "user", content: query }]);
    setInput("");
    setLoading(true);
    try {
      const response = await api.ask(query, conversationId);
      setConversationId(response.conversationId);
      setTurns((prev) => [...prev, { role: "assistant", content: response.answer, response }]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong answering that question. Please try again.", failed: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[420px] flex-col">
      <div className="shrink-0 pb-5">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask questions grounded in your uploaded documents.</p>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-secondary">
              <Sparkles className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Ask anything about your documents</p>
              <p className="text-sm text-muted-foreground">Answers are grounded in your uploads, with sources cited.</p>
            </div>
            <div className="flex max-w-md flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <Button key={q} variant="outline" size="sm" onClick={() => ask(q)}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, i) => <ChatBubble key={i} turn={turn} />)
        )}

        {loading && (
          <div className="flex items-start gap-3">
            <Avatar role="assistant" />
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-4 flex shrink-0 items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-subtle"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your documents..."
          rows={1}
          className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function normalizeMarkdown(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  const isListItem = (line: string) => /^\s*([-*+]|\d+[.)])\s+/.test(line);
  const isHeadingLike = (line: string) => /^\s*(\*\*[^*]+\*\*:?|#{1,6}\s)/.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = out[out.length - 1];
    const needsBlankBefore =
      (isListItem(line) && prev !== undefined && prev.trim() !== "" && !isListItem(prev)) ||
      (isHeadingLike(line) && prev !== undefined && prev.trim() !== "");
    if (needsBlankBefore) out.push("");
    out.push(line);
  }
  return out.join("\n");
}

function MarkdownContent({ content, invert }: { content: string; invert?: boolean }) {
  return (
    <div
      className={cn(
        "space-y-2.5 text-sm leading-relaxed",
        "[&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4.5 [&_ol]:pl-4.5",
        "[&_li]:mt-1 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
        "[&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h1]:mt-3 [&_h2]:mt-3 [&_h3]:mt-3",
        invert && "[&_code]:bg-primary-foreground/15"
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(content)}</ReactMarkdown>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
        role === "user" ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground"
      )}
    >
      {role === "user" ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
    </div>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <Avatar role={turn.role} />
      <div className={cn("min-w-0 max-w-[80%]", isUser && "flex flex-col items-end")}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground">
            <MarkdownContent content={turn.content} invert />
          </div>
        ) : (
          <AssistantMessage turn={turn} />
        )}
      </div>
    </div>
  );
}

function AssistantMessage({ turn }: { turn: ChatTurn }) {
  const r = turn.response;
  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl rounded-tl-sm border px-4 py-3",
        turn.failed ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
      )}
    >
      <MarkdownContent content={turn.content} />

      {r && (
        <>
          {(r.citations.length > 0 || r.fromCache) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <ConfidenceBadge confidence={r.confidence} lowContext={r.lowContext} />
              {r.fromCache && <Badge variant="outline">Cached</Badge>}
              {r.citations.slice(0, 4).map((c, i) => (
                <HoverCard key={c.chunkId}>
                  <HoverCardTrigger asChild>
                    <Badge variant="secondary" className="cursor-default">
                      [{i + 1}] {c.filename}
                      {c.page ? ` p.${c.page}` : ""}
                    </Badge>
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {c.filename}
                      {c.section ? ` — ${c.section}` : ""}
                    </p>
                    <p className="text-xs leading-relaxed">{c.excerpt}...</p>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </div>
          )}

          {r.contradictions.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Found {r.contradictions.length} potential contradiction{r.contradictions.length > 1 ? "s" : ""} related
                to this answer — see the Contradictions dashboard.
              </span>
            </div>
          )}

          {r.trace.retrievedChunks.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                How I found this
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 rounded-lg bg-secondary/60 p-3 text-xs">
                {r.trace.retrievedChunks.map((c, i) => (
                  <div key={c.chunkId} className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      [{i + 1}] {c.filename}
                    </span>
                    <span className="shrink-0 text-muted-foreground">similarity {c.similarity.toFixed(2)}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
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
