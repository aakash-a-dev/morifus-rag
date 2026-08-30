import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { validateBody } from "../middleware/validate";

export const contradictionsRouter = Router();

contradictionsRouter.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const contradictions = await prisma.contradiction.findMany({
      where: { workspaceId: req.workspaceId!, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        chunkA: { include: { document: true } },
        chunkB: { include: { document: true } },
      },
    });
    res.json(contradictions);
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({
  status: z.enum(["resolved", "false_positive", "open"]),
});

contradictionsRouter.patch("/:id/status", validateBody(statusSchema), async (req, res, next) => {
  try {
    const { status } = req.body as z.infer<typeof statusSchema>;
    const existing = await prisma.contradiction.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!existing) return res.status(404).json({ error: "NotFound" });

    const updated = await prisma.contradiction.update({
      where: { id: req.params.id },
      data: { status, resolvedAt: status === "open" ? null : new Date() },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
