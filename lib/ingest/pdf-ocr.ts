import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";
import { createWorker, Worker } from "tesseract.js";

export async function pdfToTextWithOcr(buffer: Buffer): Promise<string> {
  // Copy into a standalone Uint8Array — passing a view into Node's shared
  // Buffer pool risks pdfjs detaching/transferring the underlying ArrayBuffer.
  const data = new Uint8Array(buffer);

  const loadingTask = getDocument({ data });
  let doc;
  try {
    doc = await loadingTask.promise;
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
    // Release pdfjs resources (matters in the long-running server). destroy()
    // on the loading task tears down the document and its worker.
    try {
      await loadingTask.destroy();
    } catch {
      // best-effort cleanup
    }
  }

  return texts.join("\n\n");
}
