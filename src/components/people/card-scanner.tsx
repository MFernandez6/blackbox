"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseBusinessCard, type CardFields } from "@/lib/people/card-parser";

export type CardScan = {
  fields: CardFields;
  text: string;
  image: Blob;
  previewUrl: string;
};

const OCR_MAX_SIDE = 1200;
const UPLOAD_MAX_SIDE = 1600;
const READ_TIMEOUT_MS = 20_000;

async function decodeImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img> decoding (older Safari)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawScaled(
  source: CanvasImageSource & { width: number; height: number },
  maxSide: number,
  rotate: 0 | 90 | 270 = 0
) {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = rotate ? h : w;
  canvas.height = rotate ? w : h;
  const ctx = canvas.getContext("2d")!;
  if (rotate) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(source, -w / 2, -h / 2, w, h);
  } else {
    ctx.drawImage(source, 0, 0, w, h);
  }
  return canvas;
}

/** Grayscale + contrast stretch so Tesseract sees crisp text under poor lighting. */
function prepareForOcr(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const y = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = y;
    hist[y]++;
  }
  const total = px.length / 4;
  const clip = total * 0.02;
  let lo = 0;
  let below = hist[0];
  while (lo < 254 && below < clip) below += hist[++lo];
  let hi = 255;
  let above = hist[255];
  while (hi > 1 && above < clip) above += hist[--hi];
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85)
  );
}

function usableChars(text: string) {
  return text.replace(/[^a-z0-9@]/gi, "").length;
}

/** Stop after one pass once the card has something worth filling in. */
function usefulReading(text: string) {
  if (usableChars(text) < 8) return false;
  const fields = parseBusinessCard(text);
  return Boolean(fields.email || fields.mobilePhone || fields.officePhone || fields.name);
}

type Reader = import("tesseract.js").Worker;
const busyListeners = new Set<(busy: boolean) => void>();
let readerBusy = false;
let readerPromise: Promise<Reader> | null = null;
let statusListener: ((status: string) => void) | null = null;
let lastStatusAt = 0;

function setReaderBusy(next: boolean) {
  readerBusy = next;
  busyListeners.forEach((listener) => listener(next));
}

function reportStatus(status: string) {
  const now = Date.now();
  if (status.startsWith("Reading") && now - lastStatusAt < 400) return;
  lastStatusAt = now;
  statusListener?.(status);
}

function getReader() {
  if (!readerPromise) {
    readerPromise = (async () => {
      reportStatus("Loading card reader…");
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        workerBlobURL: false,
        logger: (m) => {
          if (m.status === "recognizing text") {
            reportStatus(`Reading card… ${Math.round(m.progress * 100)}%`);
          } else if (m.status.includes("loading")) {
            reportStatus("Loading card reader…");
          }
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        user_defined_dpi: "300",
      });
      return worker;
    })().catch((error) => {
      readerPromise = null;
      throw error;
    });
  }
  return readerPromise;
}

function withTimeout<T>(work: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function resetReader() {
  const pending = readerPromise;
  readerPromise = null;
  if (!pending) return;
  const worker = await pending.catch(() => null);
  await worker?.terminate().catch(() => undefined);
}

export function CardScanner({
  onScanned,
  disabled,
  label = "Scan business card",
}: {
  onScanned: (scan: CardScan) => void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(readerBusy);
  const [error, setError] = useState("");

  useEffect(() => {
    busyListeners.add(setBusy);
    void getReader().catch(() => undefined);
    return () => {
      busyListeners.delete(setBusy);
    };
  }, []);

  async function handleFile(file: File) {
    setError("");
    setStatus("Preparing photo…");
    setReaderBusy(true);
    statusListener = (next) => setStatus(next);
    try {
      const source = await decodeImage(file);
      const worker = await getReader();
      // A portrait photo is usually a landscape card turned on its side.
      const portrait = source.height > source.width * 1.15;
      const turns: Array<0 | 90 | 270> = portrait ? [90, 270] : [0, 90];
      const started = Date.now();
      let best = { text: "", chars: -1, turn: turns[0] };
      for (const turn of turns) {
        if (turn !== turns[0]) setStatus("Turning the card…");
        const { data } = await withTimeout(
          worker.recognize(prepareForOcr(drawScaled(source, OCR_MAX_SIDE, turn))),
          READ_TIMEOUT_MS
        );
        const text = data.text.trim();
        const chars = usableChars(text);
        if (chars > best.chars) best = { text, chars, turn };
        if (usefulReading(text) || Date.now() - started > 12_000) break;
      }
      const upload = await toJpeg(drawScaled(source, UPLOAD_MAX_SIDE, best.turn));

      if (!usefulReading(best.text) && best.chars < 8) {
        setError("Couldn't read that card. Try again with the card filling the frame in good light.");
        return;
      }
      onScanned({
        fields: parseBusinessCard(best.text),
        text: best.text,
        image: upload,
        previewUrl: URL.createObjectURL(upload),
      });
    } catch (e) {
      console.error("Card scan failed:", e);
      if (e instanceof Error && e.message === "timeout") {
        await resetReader();
        setError("That photo took too long to read. Move the card closer so it fills the frame, then try again.");
      } else {
        setError("The card reader failed to load. Check your connection and try again.");
      }
    } finally {
      if (statusListener) statusListener = null;
      setReaderBusy(false);
      setStatus(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="solid"
        disabled={disabled || busy || status !== null}
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        {status ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        {status ?? label}
      </Button>
      {error ? <p className="text-sm text-denied-soft">{error}</p> : null}
    </div>
  );
}
