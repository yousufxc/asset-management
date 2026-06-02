/**
 * Send clean markdown to the Claude API, get back a structured JSON
 * installment schedule validated by ParsedScheduleSchema.
 *
 * Permitted outbound call per rule 2.4 (Claude API).
 * ANTHROPIC_API_KEY must be set in .env.local — never committed.
 *
 * Contract: parseScheduleFromMarkdown(markdown: string): Promise<ParsedSchedule>
 * On ANY failure (API error, bad JSON, validation), throws with raw text for manual review.
 */

import { ParsedScheduleSchema } from "@/lib/ingest/validate";
import type { ParsedSchedule } from "@/lib/ingest/validate";

const SYSTEM_PROMPT = `You are a parser that extracts off-plan property payment schedules from text.

Return ONLY valid JSON — no prose, no markdown code fences, no explanation. The JSON must match this exact shape:

{
  "property_name": "optional string or null",
  "developer": "optional string or null",
  "installments": [
    {
      "due_date": "YYYY-MM-DD",
      "amount_aed": number (positive, e.g. 75000.00),
      "milestone_label": "optional string or null"
    }
  ]
}

Rules:
- due_date must be YYYY-MM-DD format.
- amount_aed must be a number, not a string. Do NOT include currency symbols.
- milestone_label should describe the payment milestone in plain text.
- The installments array must NOT be empty.
- Return ONLY the JSON object. No other text.`;

export async function parseScheduleFromMarkdown(markdown: string): Promise<ParsedSchedule> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("parseScheduleFromMarkdown: ANTHROPIC_API_KEY not set in .env.local");
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey });

  let rawText: string;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Extract the payment schedule from this off-plan SPA text:\n\n${markdown}`,
        },
      ],
    });

    const firstBlock = msg.content.find((b) => b.type === "text");
    rawText = firstBlock && "text" in firstBlock ? (firstBlock as { text: string }).text : "";
  } catch (err) {
    throw new Error(
      `Claude API call failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Strip any markdown code fences the model may have emitted despite instructions
  let jsonStr = rawText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n/, "").replace(/\n```\s*$/, "");
    jsonStr = jsonStr.trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Claude did not return valid JSON. Raw response:\n${rawText}`,
    );
  }

  const result = ParsedScheduleSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Claude JSON failed schema validation: ${JSON.stringify(result.error.flatten())}. Raw:\n${rawText}`,
    );
  }

  return result.data;
}
