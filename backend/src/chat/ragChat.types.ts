export interface Citation {
  chunkId: string;
  documentId: string;
  filename: string;
  page: number | null;
  section: string | null;
  similarity: number;
  excerpt: string;
}
