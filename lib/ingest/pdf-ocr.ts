import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, type Canvas } from "canvas";
import { createWorker, Worker } from "tesseract.js";

type CanvasAndContext = { canvas: Canvas | null; context: unknown };

/**
 * pdf.js's built-in Node canvas factory uses `@napi-rs/canvas`, a DIFFERENT
 * canvas library than the `canvas` (node-canvas) package we render onto. When
 * pdf.js paints an image it draws its factory-created canvas onto our
 * node-canvas context, and node-canvas's drawImage rejects the foreign object
 * ("Image or Canvas expected") — which breaks exactly the scanned/image PDFs
 * OCR exists for (text-only PDFs never hit the image path). Supplying a factory
 * backed by the same `canvas` package keeps every canvas compatible.
 */
class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(cc: CanvasAndContext, width: number, height: number): void {
    if (!cc.canvas) throw new Error("Canvas is not specified");
    cc.canvas.width = width;
    cc.canvas.height = height;
  }
  destroy(cc: CanvasAndContext): void {
    if (cc.canvas) {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    }
    cc.canvas = null;
    cc.context = null;
  }
}

export async function pdfToTextWithOcr(buffer: Buffer): Promise<string> {
  // Copy into a standalone Uint8Array — passing a view into Node's shared
  // Buffer pool risks pdfjs detaching/transferring the underlying ArrayBuffer.
  const data = new Uint8Array(buffer);

  const loadingTask = getDocument({
    data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CanvasFactory: NodeCanvasFactory as any,
  });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (e) {
    console.error("pdf-ocr: failed to open PDF with pdfjs:", e);
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
      } catch (e) {
        console.error(`pdf-ocr: page ${i} render/OCR failed:`, e);
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
