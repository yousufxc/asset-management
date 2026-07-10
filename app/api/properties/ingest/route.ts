import { NextRequest, NextResponse } from "next/server";
import { TitleDeedExtractSchema } from "@/lib/ingest/validate";
import { buildDeedExtractionPrompt } from "@/lib/ingest/deed-prompt";
import { getSetting } from "@/lib/db/settings";
import { pdfToTextWithOcr } from "@/lib/ingest/pdf-ocr";
import Anthropic from "@anthropic-ai/sdk";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function pdfToText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is 10 MB.` },
      { status: 400 },
    );
  }

  let deedText = "";
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    deedText = await pdfToText(buffer);
  } catch {
    // native extraction failed, try OCR
  }

  if (!deedText || deedText.trim().length === 0) {
    try {
      deedText = await pdfToTextWithOcr(buffer);
    } catch {
      // OCR also failed
    }
  }

  if (!deedText || deedText.trim().length === 0) {
    return NextResponse.json(
      { error: "Failed to read PDF. The file may be corrupted, contain no readable text, or be a scanned image that could not be OCR'd." },
      { status: 400 },
    );
  }

  let apiKey: string;
  try {
    apiKey = getSetting("anthropicApiKey");
  } catch {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Add it in Settings." },
      { status: 401 },
    );
  }

  const prompt = buildDeedExtractionPrompt(deedText);
  const anthropic = new Anthropic({ apiKey });

  let rawJson: string;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    rawJson = text.trim();
    if (rawJson.startsWith("```")) {
      rawJson = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "AI extraction failed", detail: message },
      { status: 502 },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse extracted data. The AI returned an invalid response. Please try again." },
      { status: 502 },
    );
  }

  const validated = TitleDeedExtractSchema.safeParse(parsedJson);
  if (!validated.success) {
    return NextResponse.json(
      { error: "Extracted data failed validation", issues: validated.error.flatten() },
      { status: 422 },
    );
  }

  const extracted = validated.data;
  const hasAnyField = Object.values(extracted).some((v) => v !== null && v !== undefined);
  if (!hasAnyField) {
    return NextResponse.json(
      { error: "No property details could be extracted from this document." },
      { status: 422 },
    );
  }

  return NextResponse.json({ extracted });
}
