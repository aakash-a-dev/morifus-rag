"use client";

import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { WorkspaceNavBar } from "@/components/workspace-nav-bar";

function Shell({ children }: { children: React.ReactNode }) {
  const { workspace, loading, error } = useWorkspace();

  if (loading) {
    return <div className="py-24 text-center text-sm text-muted-foreground">Loading workspace...</div>;
  }
  if (error || !workspace) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Workspace not found."}</p>
        <a href="/" className="mt-3 inline-block text-sm underline underline-offset-4">
          Back to home
        </a>
      </div>
    );
  }

  return (
    <>
      <WorkspaceNavBar name={workspace.name} slug={workspace.slug} />
      <div className="container py-8">{children}</div>
    </>
  );
}

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <WorkspaceProvider slug={params.slug}>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
