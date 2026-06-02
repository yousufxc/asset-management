/**
 * STEP 1 of the PDF pipeline (§6): strip a PDF to clean markdown LOCALLY,
 * before anything is sent to the Claude API. Removes layout noise, repeated
 * headers/footers, page furniture — minimizing tokens and improving accuracy.
 *
 * Phase 1 stub. DeepSeek to implement with `pdf-parse` (local, no network).
 * Never send a raw PDF when clean markdown will do.
 */

export async function pdfToMarkdown(_filePath: string): Promise<string> {
  throw new Error("pdfToMarkdown: not implemented (Phase 1 task)");
}
