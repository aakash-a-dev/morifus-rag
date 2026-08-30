export {};

declare global {
  namespace Express {
    interface Request {
      workspaceId?: string;
      workspaceSlug?: string;
    }
  }
}
