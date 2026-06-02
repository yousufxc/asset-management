/**
 * STEP 2 of the PDF pipeline (§6): send the clean markdown to the Claude API
 * with a strict schema instruction; expect valid JSON ONLY (no prose, no fences).
 * The result MUST be validated with ParsedScheduleSchema (lib/ingest/validate.ts)
 * before any DB write — never trust the model's JSON unvalidated.
 *
 * Phase 1 stub. DeepSeek to implement using ANTHROPIC_API_KEY from env.
 * This is one of the few permitted outbound calls (rule 2.4).
 */

import type { ParsedSchedule } from "@/lib/ingest/validate";

export async function parseScheduleFromMarkdown(_markdown: string): Promise<ParsedSchedule> {
  throw new Error("parseScheduleFromMarkdown: not implemented (Phase 1 task)");
}
