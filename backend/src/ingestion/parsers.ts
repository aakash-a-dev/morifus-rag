import fs from "fs/promises";
import path from "path";

export interface ParsedPage {
  page: number;
  text: string;
}

export interface ParsedDocument {
  fullText: string;
  pages: ParsedPage[];
}

export class UnsupportedFileTypeError extends Error {}
export class CorruptedFileError extends Error {}

export async function parseFile(filePath: string, mimeType: string, filename: string): Promise<ParsedDocument> {
  const ext = path.extname(filename).toLowerCase();

  try {
    if (mimeType === "application/pdf" || ext === ".pdf") {
      return await parsePdf(filePath);
    }
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === ".docx"
    ) {
      return await parseDocx(filePath);
    }
    if (mimeType === "text/markdown" || ext === ".md") {
      return await parsePlainText(filePath);
    }
    if (mimeType === "text/plain" || ext === ".txt") {
      return await parsePlainText(filePath);
    }
    throw new UnsupportedFileTypeError(`Unsupported file type: ${mimeType || ext}`);
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) throw err;
    throw new CorruptedFileError(
      `Failed to parse "${filename}": ${(err as Error).message}`
    );
  }
}

async function parsePdf(filePath: string): Promise<ParsedDocument> {
  // pdf-parse's default export runs its debug/test harness on import; use the lib entrypoint directly.
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);

  const rawPages: string[] = data.text.split("\f"); // pdf-parse separates pages with form-feed
  const pages: ParsedPage[] = rawPages
    .map((text: string, i: number) => ({ page: i + 1, text: text.trim() }))
    .filter((p: ParsedPage) => p.text.length > 0);

  return { fullText: data.text, pages: pages.length ? pages : [{ page: 1, text: data.text }] };
}

async function parseDocx(filePath: string): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const buffer = await fs.readFile(filePath);
  const { value } = await mammoth.extractRawText({ buffer });
  return { fullText: value, pages: [{ page: 1, text: value }] };
}

async function parsePlainText(filePath: string): Promise<ParsedDocument> {
  const text = await fs.readFile(filePath, "utf-8");
  return { fullText: text, pages: [{ page: 1, text }] };
}
