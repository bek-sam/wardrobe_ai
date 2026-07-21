import { readdir, rm } from "node:fs/promises";
import path from "node:path";

export async function resumeIncompleteJobs({ jobsDir, store, generator }) {
  const ids = await readdir(jobsDir).catch(() => []);
  for (const id of ids) {
    const job = await store.loadJob(id);
    if (!job) continue;
    if (job.status === "complete") {
      try {
        await store.persistImported(job, true);
        await rm(path.join(jobsDir, job.id), { recursive: true, force: true });
      } catch (error) {
        job.status = "active";
        job.stages.modeled.status = "review";
        job.stages.modeled.decision = null;
        job.stages.modeled.error = null;
        await store.saveJob(job);
      }
      continue;
    }
    if (job.stages.crop?.status === "rejected" || job.stages.garment.status === "rejected" || job.stages.modeled.status === "rejected") {
      await rm(path.join(jobsDir, job.id), { recursive: true, force: true });
      continue;
    }
    if (job.stages.crop && job.stages.crop.status !== "approved") continue;
    if (["processing", "queued"].includes(job.stages.garment.status)) {
      job.stages.garment.status = "pending";
      await store.saveJob(job);
      void generator.generate(job, "garment");
    } else if (job.stages.garment.status === "approved" && ["pending", "processing", "queued"].includes(job.stages.modeled.status)) {
      job.stages.modeled.status = "pending";
      await store.saveJob(job);
      void generator.generate(job, "modeled");
    }
  }
}
