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
    const workspaceId = req.workspaceId!;
    const { conversationId, query, documentIds } = req.body as z.infer<typeof askSchema>;

    const conversation = conversationId
      ? await prisma.conversation.findFirst({ where: { id: conversationId, workspaceId } })
      : await prisma.conversation.create({ data: { workspaceId, title: query.slice(0, 60) } });

    if (!conversation) {
      return res.status(404).json({ error: "NotFound", message: "Conversation not found" });
    }

    const result = await answerQuery(workspaceId, conversation.id, query, documentIds);
    res.json({ conversationId: conversation.id, ...result });
  } catch (err) {
    next(err);
  }
});

chatRouter.get("/conversations", async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId!;
    const conversations = await prisma.conversation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
    });
    res.json(
      conversations.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        lastMessageAt: c.messages[0]?.createdAt ?? c.createdAt,
        messageCount: c._count.messages,
      }))
    );
  } catch (err) {
    next(err);
  }
});

chatRouter.get("/conversations/:id/messages", async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
    });
    if (!conversation) return res.status(404).json({ error: "NotFound" });

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" },
    });

    const allChunkIds = [...new Set(messages.flatMap((m) => m.citedChunkIds))];
    const chunks = allChunkIds.length
      ? await prisma.chunk.findMany({
          where: { id: { in: allChunkIds } },
          select: { id: true, filename: true, page: true, section: true, content: true, documentId: true },
        })
      : [];
    const chunkById = new Map(chunks.map((c) => [c.id, c]));

    res.json(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        confidence: m.confidence,
        fromCache: m.fromCache,
        createdAt: m.createdAt,
        citations: m.citedChunkIds
          .map((id) => chunkById.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((c) => ({
            chunkId: c.id,
            documentId: c.documentId,
            filename: c.filename,
            page: c.page,
            section: c.section,
            similarity: 0,
            excerpt: c.content.slice(0, 240),
          })),
      }))
    );
  } catch (err) {
    next(err);
  }
});
