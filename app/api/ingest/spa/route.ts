import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { pdfToMarkdown } from "@/lib/ingest/pdf-to-markdown";
import { parseScheduleFromMarkdown } from "@/lib/ingest/parse-claude";
import { aedToFils, formatIsoToUae } from "@/lib/core/units";
import { insertInstallment, installmentExistsByKey, getProperty } from "@/lib/db/queries";

function sanitizeFilename(original: string): string {
  const base = basename(original);
  const safe = base.replace(/[^A-Za-z0-9._-]/g, "_");
  const ts = Date.now();
  return `${ts}_${safe}`;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  const propertyIdRaw = formData.get("property_id");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (!propertyIdRaw || typeof propertyIdRaw !== "string") {
    return NextResponse.json({ error: "Missing property_id field" }, { status: 400 });
  }

  const propertyId = Number(propertyIdRaw);
  if (!Number.isInteger(propertyId) || propertyId < 1) {
    return NextResponse.json({ error: "Invalid property_id" }, { status: 400 });
  }

  if (!getProperty(propertyId)) {
    return NextResponse.json({ error: `No property with id ${propertyId}` }, { status: 400 });
  }

  const originalName = file.name;
  const safeName = sanitizeFilename(originalName);
  const uploadsDir = join(process.cwd(), "uploads");
  const filePath = join(uploadsDir, safeName);

  try {
    // Ensure uploads dir exists
    await mkdir(uploadsDir, { recursive: true });

    // Save the uploaded file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Pipeline: PDF → markdown → Claude → validated schedule
    const markdown = await pdfToMarkdown(filePath);
    const schedule = await parseScheduleFromMarkdown(markdown);

    let inserted = 0;
    let skipped = 0;

    for (const inst of schedule.installments) {
      const dueDateIso = inst.due_date; // already ISO from Claude output
      const amountFils = aedToFils(inst.amount_aed);

      // Idempotency: skip if already exists by (property_id, due_date, amount_fils)
      if (installmentExistsByKey(propertyId, dueDateIso, amountFils)) {
        skipped++;
        continue;
      }

      insertInstallment({
        property_id: propertyId,
        due_date: formatIsoToUae(dueDateIso),
        amount_aed: inst.amount_aed,
        milestone_label: inst.milestone_label,
        status: "upcoming",
        source: "pdf",
        source_file: originalName,
      });
      inserted++;
    }

    return NextResponse.json(
      {
        inserted,
        skipped,
        property_id: propertyId,
        total: schedule.installments.length,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Ingestion failed", reason: message },
      { status: 422 },
    );
  }
}
