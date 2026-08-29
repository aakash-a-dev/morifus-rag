import { ParsedPage } from "./parsers";

export interface Chunk {
  content: string;
  page: number;
  section: string | null;
  chunkIndex: number;
}

const TARGET_CHARS = 2800; // ~500-800 tokens
const OVERLAP_CHARS = Math.round(TARGET_CHARS * 0.15);
const SECTION_HEADING_RE = /^(#{1,6}\s+.+|[A-Z][A-Z0-9 ,'&/-]{4,80})$/m;

/**
 * Recursive/markdown-aware splitter: splits on paragraph boundaries first,
 * falling back to sentence and hard character splits, while tracking the
 * nearest preceding heading as the "section" for citation metadata.
 */
export function chunkDocument(pages: ParsedPage[]): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  let currentSection: string | null = null;

  for (const page of pages) {
    const paragraphs = page.text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
    let buffer = "";

    const flush = () => {
      if (buffer.trim().length === 0) return;
      chunks.push({
        content: buffer.trim(),
        page: page.page,
        section: currentSection,
        chunkIndex: chunkIndex++,
      });
      buffer = buffer.slice(Math.max(0, buffer.length - OVERLAP_CHARS));
    };

    for (const paragraph of paragraphs) {
      const headingMatch = paragraph.trim().match(SECTION_HEADING_RE);
      if (headingMatch && paragraph.trim().length < 90) {
        currentSection = paragraph.trim().replace(/^#{1,6}\s+/, "");
      }

      if ((buffer + "\n\n" + paragraph).length > TARGET_CHARS) {
        flush();
      }
      buffer += (buffer ? "\n\n" : "") + paragraph;

      // hard split extremely long paragraphs
      while (buffer.length > TARGET_CHARS * 1.5) {
        const splitPoint = findSentenceBoundary(buffer, TARGET_CHARS);
        chunks.push({
          content: buffer.slice(0, splitPoint).trim(),
          page: page.page,
          section: currentSection,
          chunkIndex: chunkIndex++,
        });
        buffer = buffer.slice(Math.max(0, splitPoint - OVERLAP_CHARS));
      }
    }
    flush();
  }

  return chunks;
}

function findSentenceBoundary(text: string, near: number): number {
  const window = text.slice(0, near + 200);
  const lastPeriod = window.lastIndexOf(". ");
  return lastPeriod > near * 0.5 ? lastPeriod + 1 : near;
}
