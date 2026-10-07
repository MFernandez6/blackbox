"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseBusinessCard, type CardFields } from "@/lib/people/card-parser";

export type CardScan = {
  fields: CardFields;
  text: string;
  image: Blob;
  previewUrl: string;
};

const OCR_MAX_SIDE = 2000;
const UPLOAD_MAX_SIDE = 1600;

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

const GOOD_READING = 100;

/** Garbage OCR can still report decent confidence, so reward actual contact details. */
function readingScore(text: string, confidence: number) {
  const f = parseBusinessCard(text);
  const realWords = (text.match(/\b[A-Za-z]{4,}\b/g) ?? []).length;
  return (
    confidence +
    (f.email ? 25 : 0) +
    (f.mobilePhone ? 15 : 0) +
    (f.officePhone ? 10 : 0) +
    (f.name ? 10 : 0) +
    Math.min(realWords, 15)
  );
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
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setStatus("Preparing photo…");
    let worker: import("tesseract.js").Worker | null = null;
    try {
      const source = await decodeImage(file);

      const { createWorker } = await import("tesseract.js");
      worker = await createWorker(["eng", "spa"], 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setStatus(`Reading card… ${Math.round(m.progress * 100)}%`);
          } else if (m.status.includes("loading")) {
            setStatus("Loading card reader…");
          }
        },
      });

      // Most cards are landscape, so a portrait photo is usually a sideways card.
      const portrait = source.height > source.width * 1.1;
      const turns: Array<0 | 90 | 270> = portrait ? [90, 270, 0] : [0, 90, 270];
      let best = { text: "", score: -Infinity, turn: turns[0] };
      for (const turn of turns) {
        if (turn !== turns[0]) setStatus("Turning the card…");
        const { data } = await worker.recognize(
          prepareForOcr(drawScaled(source, OCR_MAX_SIDE, turn))
        );
        const score = readingScore(data.text, data.confidence);
        if (score > best.score) best = { text: data.text, score, turn };
        if (best.score >= GOOD_READING) break;
      }
      const upload = await toJpeg(drawScaled(source, UPLOAD_MAX_SIDE, best.turn));

      const text = best.text.trim();
      if (usableChars(text) < 8) {
        setError("Couldn't read that card. Try again with the card filling the frame in good light.");
        return;
      }
      onScanned({
        fields: parseBusinessCard(text),
        text,
        image: upload,
        previewUrl: URL.createObjectURL(upload),
      });
    } catch (e) {
      console.error("Card scan failed:", e);
      setError("The card reader failed to load. Check your connection and try again.");
    } finally {
      await worker?.terminate().catch(() => undefined);
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
        disabled={disabled || status !== null}
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
