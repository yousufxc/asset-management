import { describe, it, expect, vi, beforeAll } from "vitest";

const makeHelloPdf = (): Buffer => {
  const font = Buffer.from(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );
  const contentStream = Buffer.from(
    "BT\n/F1 24 Tf\n100 700 Td\n(Hello World) Tj\nET\n",
  );
  const contentObj = Buffer.from(
    `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n`,
  );
  const contentEnd = Buffer.from("\nendstream\nendobj\n");
  const pageObj = Buffer.from(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n/Contents 4 0 R\n/Resources << /Font << /F1 5 0 R >> >>\n>>\nendobj\n",
  );
  const pagesObj = Buffer.from(
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
  );
  const catalogObj = Buffer.from(
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
  );
  const header = Buffer.from("%PDF-1.4\n");

  const parts: Buffer[] = [header];
  const offsets: number[] = [];

  const addObj = (buf: Buffer) => {
    offsets.push(header.length + parts.reduce((s, b) => s + b.length, 0));
    parts.push(buf);
  };

  addObj(catalogObj);
  addObj(pagesObj);
  addObj(pageObj);
  parts.push(contentObj, contentStream, contentEnd);
  addObj(font);

  const startxref = parts.reduce((s, b) => s + b.length, 0);
  const xrefEntries = [
    `0 6`,
    `0000000000 65535 f `,
    offsets.map((o, i) => `${String(o).padStart(10, "0")} 00000 n `).join("\n"),
  ].join("\n");

  const xref = Buffer.from(`xref\n${xrefEntries}\n`);
  const trailer = Buffer.from(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`,
  );

  parts.push(xref, trailer);
  return Buffer.concat(parts);
};

describe("pdfToTextWithOcr", () => {
  let pdfToTextWithOcr: (buffer: Buffer) => Promise<string>;

  beforeAll(async () => {
    const mod = await import("@/lib/ingest/pdf-ocr");
    pdfToTextWithOcr = mod.pdfToTextWithOcr;
  });

  it("extracts text from a simple rendered PDF", async () => {
    const pdf = makeHelloPdf();
    const text = await pdfToTextWithOcr(pdf);
    expect(text).toBeTruthy();
    expect(text.toLowerCase()).toContain("hello");
  }, 30000);

  it("handles corrupted data gracefully", async () => {
    const result = await pdfToTextWithOcr(Buffer.from("not a pdf"));
    expect(result).toBe("");
  });

  it("handles empty buffer", async () => {
    const result = await pdfToTextWithOcr(Buffer.alloc(0));
    expect(result).toBe("");
  });
});
