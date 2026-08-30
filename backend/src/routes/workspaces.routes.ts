import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { createWorkspace, getWorkspaceBySlug, listRecentWorkspaces } from "../workspaces/workspacesService";

export const workspacesRouter = Router();

const createSchema = z.object({ name: z.string().min(1).max(120) });

workspacesRouter.post("/", validateBody(createSchema), async (req, res, next) => {
  try {
    const { name } = req.body as z.infer<typeof createSchema>;
    const workspace = await createWorkspace(name);
    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
});

workspacesRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await listRecentWorkspaces());
  } catch (err) {
    next(err);
  }
});

workspacesRouter.get("/:slug", async (req, res, next) => {
  try {
    const workspace = await getWorkspaceBySlug(req.params.slug);
    if (!workspace) return res.status(404).json({ error: "NotFound" });
    res.json(workspace);
  } catch (err) {
    next(err);
  }
});
