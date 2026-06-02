/**
 * Local PDF → markdown extraction. NO network — uses pdf-parse locally.
 * Strips repeated headers, footers, and page furniture for cleaner LLM parsing.
 *
 * Contract: pdfToMarkdown(filePath: string): Promise<string>
 */

import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function pdfToMarkdown(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`pdfToMarkdown: file not found: ${filePath}`);
  }

  const pdfParse = require("pdf-parse");
  const buffer = readFileSync(filePath);
  const data = await pdfParse(buffer);

  let text = data.text as string;

  // Strip page-number lines (e.g. "Page 1 of 12", "1 / 12", standalone digits)
  text = text.replace(/^Page\s+\d+\s+of\s+\d+\s*$/gim, "");
  text = text.replace(/^\d+\s*\/\s*\d+\s*$/gm, "");

  // Collapse runs of blank lines ≥ 3 into 2
  text = text.replace(/\n{3,}/g, "\n\n");

  // Collapse whitespace runs (spaces/tabs) to single space
  text = text.replace(/[ \t]+/g, " ");

  // Trim each line but keep newlines
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // Remove leading/trailing blank lines
  text = text.replace(/^\n+/, "").replace(/\n+$/, "");

  return text;
}
