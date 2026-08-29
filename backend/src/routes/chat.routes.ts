import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { validateBody } from "../middleware/validate";
import { answerQuery } from "../chat/ragChat";

export const chatRouter = Router();

const askSchema = z.object({
  conversationId: z.string().uuid().optional(),
  query: z.string().min(1).max(2000),
  documentIds: z.array(z.string().uuid()).default([]),
});

chatRouter.post("/ask", validateBody(askSchema), async (req, res, next) => {
  try {
    const { conversationId, query, documentIds } = req.body as z.infer<typeof askSchema>;

    const conversation = conversationId
      ? await prisma.conversation.findUnique({ where: { id: conversationId } })
      : await prisma.conversation.create({ data: { title: query.slice(0, 60) } });

    if (!conversation) {
      return res.status(404).json({ error: "NotFound", message: "Conversation not found" });
    }

    const result = await answerQuery(conversation.id, query, documentIds);
    res.json({ conversationId: conversation.id, ...result });
  } catch (err) {
    next(err);
  }
});

chatRouter.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
});
