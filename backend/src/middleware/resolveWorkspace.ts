import { RequestHandler } from "express";
import { getWorkspaceBySlug } from "../workspaces/workspacesService";

export const resolveWorkspace: RequestHandler = async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) {
      return res.status(404).json({ error: "NotFound", message: `No workspace "${slug}"` });
    }
    req.workspaceId = workspace.id;
    req.workspaceSlug = workspace.slug;
    next();
  } catch (err) {
    next(err);
  }
};
