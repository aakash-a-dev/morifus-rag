import { prisma } from "../db/prisma";
import { slugify, randomSuffix } from "./slug";

export async function createWorkspace(name: string) {
  const base = slugify(name);
  let slug = base;
  // Retry a handful of times on slug collision rather than pre-checking -
  // avoids a race between check and insert, and collisions are rare.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.workspace.create({ data: { name, slug } });
    } catch (err: any) {
      if (err?.code === "P2002") {
        slug = `${base}-${randomSuffix()}`;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not allocate a unique workspace slug");
}

export async function getWorkspaceBySlug(slug: string) {
  return prisma.workspace.findUnique({ where: { slug } });
}

export async function listRecentWorkspaces(limit = 20) {
  return prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { _count: { select: { documents: true } } },
  });
}
