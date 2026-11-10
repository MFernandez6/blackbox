import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = process.cwd();
const out = path.join(root, "public", "ocr");
const coreOut = path.join(out, "core");
const langOut = path.join(out, "lang");

mkdirSync(coreOut, { recursive: true });
mkdirSync(langOut, { recursive: true });

await copyFile(
  path.join(root, "node_modules/tesseract.js/dist/worker.min.js"),
  path.join(out, "worker.min.js")
);

const cores = [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
];
for (const name of cores) {
  await copyFile(path.join(root, "node_modules/tesseract.js-core", name), path.join(coreOut, name));
}

const models = {
  eng: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
};

for (const [lang, url] of Object.entries(models)) {
  const dest = path.join(langOut, `${lang}.traineddata.gz`);
  if (existsSync(dest) && statSync(dest).size > 1_000_000) continue;
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Could not download the ${lang} card-reader model (${response.status}).`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}
