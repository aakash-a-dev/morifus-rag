"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { workspaceApi, createWorkspaceApi, WorkspaceDto } from "./api";

interface WorkspaceContextValue {
  slug: string;
  workspace: WorkspaceDto | null;
  loading: boolean;
  error: string | null;
  api: ReturnType<typeof createWorkspaceApi>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    workspaceApi
      .get(slug)
      .then((w) => !cancelled && setWorkspace(w))
      .catch(() => !cancelled && setError(`No workspace found for "${slug}".`))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const scopedApi = useMemo(() => createWorkspaceApi(slug), [slug]);

  return (
    <WorkspaceContext.Provider value={{ slug, workspace, loading, error, api: scopedApi }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
