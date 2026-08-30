"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { workspaceApi, WorkspaceDto, DEMO_WORKSPACE_SLUG } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recent, setRecent] = useState<WorkspaceDto[]>([]);

  useEffect(() => {
    workspaceApi
      .list()
      .then((all) => setRecent(all.filter((w) => w.slug !== DEMO_WORKSPACE_SLUG)))
      .catch(() => {});
  }, []);

  const createWorkspace = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const workspace = await workspaceApi.create(name.trim());
      router.push(`/w/${workspace.slug}/upload`);
    } catch {
      toast.error("Could not create workspace. Try a different name.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8">
      <div className="space-y-2 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Document Intelligence</h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          Upload documents, ask grounded questions with citations, and surface contradictions across sources. No
          account needed, just create a workspace and share its link.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              <CardDescription>Featured</CardDescription>
            </div>
            <CardTitle>Aakash's Demo Workspace</CardTitle>
            <CardDescription>
              Pre-loaded HR &amp; policy documents with planted contradictions. See the system work in seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={`/w/${DEMO_WORKSPACE_SLUG}/upload`}>
                Open demo workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Plus className="h-4 w-4" />
              <CardDescription>Start fresh</CardDescription>
            </div>
            <CardTitle>Create your own workspace</CardTitle>
            <CardDescription>Upload your own documents, chat, and check for contradictions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  Create workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Name your workspace</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input
                    autoFocus
                    placeholder="e.g. Acme Contracts Review"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
                  />
                  <Button className="w-full" onClick={createWorkspace} disabled={creating || !name.trim()}>
                    {creating ? "Creating..." : "Create and open"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {recent.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recently created workspaces</h2>
          <div className="flex flex-col gap-2">
            {recent.map((w) => (
              <a
                key={w.id}
                href={`/w/${w.slug}/upload`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
              >
                <span className="font-medium">{w.name}</span>
                <span className="text-xs text-muted-foreground">{w._count?.documents ?? 0} documents</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
