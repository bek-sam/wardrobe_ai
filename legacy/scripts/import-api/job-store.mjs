import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { LIBRARY_ASSET_ROOT } from "./constants.mjs";

export async function atomicJson(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
  try {
    await rename(tmp, file);
  } catch (error) {
    if (!["EBUSY", "EXDEV", "EPERM"].includes(error.code)) {
      await rm(tmp, { force: true });
      throw error;
    }
    await copyFile(tmp, file);
    await rm(tmp, { force: true });
  }
}

export function stageState() {
  return {
    status: "pending",
    decision: null,
    attempts: 0,
    assetUrl: null,
    failedAssetUrl: null,
    cleanupPreviewUrl: null,
    cleanupTolerance: 46,
    cleanupDiagnostics: null,
    error: null,
    prompt: null,
    updatedAt: null,
  };
}

export function publicJob(job) {
  const copy = structuredClone(job);
  delete copy.internal;
  return copy;
}

export function createJobStore({ jobsDir, importedFile, libraryAssetDir }) {
  async function loadJob(id) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
    try {
      return JSON.parse(await readFile(path.join(jobsDir, id, "job.json"), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async function saveJob(job) {
    job.updatedAt = new Date().toISOString();
    await atomicJson(path.join(jobsDir, job.id, "job.json"), job);
  }

  async function loadImported() {
    try {
      return JSON.parse(await readFile(importedFile, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async function persistImported(job, includeModeled = false) {
    const id = `import-${job.id}`;
    await mkdir(libraryAssetDir, { recursive: true });
    const garmentName = `${id}-garment.png`;
    const garmentSource = job.stages.garment.assetUrl
      ? path.basename(new URL(job.stages.garment.assetUrl, "http://localhost").pathname)
      : `garment-${job.stages.garment.attempts}.png`;
    await copyFile(
      path.join(jobsDir, job.id, garmentSource),
      path.join(libraryAssetDir, garmentName),
    );
    let modeledImage = null;
    if (includeModeled) {
      const modeledName = `${id}-modeled.png`;
      const modeledSource = job.stages.modeled.assetUrl
        ? path.basename(new URL(job.stages.modeled.assetUrl, "http://localhost").pathname)
        : `modeled-${job.stages.modeled.attempts}.png`;
      await copyFile(
        path.join(jobsDir, job.id, modeledSource),
        path.join(libraryAssetDir, modeledName),
      );
      modeledImage = `${LIBRARY_ASSET_ROOT}/${modeledName}`;
    }
    const metadata = job.metadata || {};
    const records = await loadImported();
    const existing = records.find((record) => record.id === id);
    const record = {
      id,
      name: metadata.name || "New piece",
      part: metadata.part || "upperbody",
      color: metadata.color || "#d8d0c2",
      secondaryColor: metadata.secondaryColor || null,
      palette: [metadata.color, metadata.secondaryColor].filter(Boolean),
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      image: `${LIBRARY_ASSET_ROOT}/${garmentName}`,
      thumbnail: `${LIBRARY_ASSET_ROOT}/${garmentName}`,
      modeledImage: modeledImage || existing?.modeledImage || null,
      importJobId: job.id,
    };
    const next = [...records.filter((item) => item.id !== id), record];
    await atomicJson(importedFile, next);
    return record;
  }

  return { loadJob, saveJob, loadImported, persistImported };
}
