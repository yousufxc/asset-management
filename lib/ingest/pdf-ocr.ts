import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";
import { createWorker, Worker } from "tesseract.js";

export async function pdfToTextWithOcr(buffer: Buffer): Promise<string> {
  let data: Uint8Array;
  try {
    data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } catch {
    return "";
  }

  let doc;
  try {
    doc = await getDocument({ data }).promise;
  } catch {
    return "";
  }

  let worker: Worker | null = null;
  const texts: string[] = [];

  try {
    worker = await createWorker("eng");

    for (let i = 1; i <= doc.numPages; i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext("2d");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        const image = canvas.toBuffer("image/png");
        const { data: { text } } = await worker.recognize(image);
        if (text && text.trim()) {
          texts.push(text.trim());
        }
      } catch {
        // skip pages that fail to render or OCR
      }
    }
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }

  return texts.join("\n\n");
}
