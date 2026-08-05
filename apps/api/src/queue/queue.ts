import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";
import { logger } from "../utils/logger";

// In-process job queue for the MVP.
//
// Production upgrade path: this file is the *only* place that needs to
// change to swap in BullMQ + Redis — everything else in the pipeline talks
// to `queue.enqueue()` / `queue.getJob()`, not to any queue implementation
// detail. To swap: replace the body of `enqueue` with `Queue#add`, replace
// `processors` registration with BullMQ `Worker` instances, and back
// `jobs` with a Redis-backed store instead of the in-memory Map below.
// That gives you retries, multi-process workers, and durability across
// restarts without touching any pipeline stage code.

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  progressPct: number;
  stage?: string;
  stagesCompleted: string[];
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, JobRecord>();
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

type Processor<T> = (payload: T, ctx: JobContext) => Promise<void>;

export interface JobContext {
  jobId: string;
  setStage: (stage: string) => void;
  setProgress: (pct: number) => void;
}

const processors = new Map<string, Processor<any>>();

export function registerProcessor<T>(type: string, processor: Processor<T>) {
  processors.set(type, processor);
}

export function enqueue<T>(type: string, payload: T): JobRecord {
  const processor = processors.get(type);
  if (!processor) {
    throw new Error(`No processor registered for job type "${type}"`);
  }

  const job: JobRecord = {
    id: uuid(),
    type,
    status: "queued",
    progressPct: 0,
    stagesCompleted: [],
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);

  // Fire and forget — the HTTP handler returns 202 immediately and the
  // client polls getJob() for progress, exactly as it would against a real
  // BullMQ-backed queue.
  setImmediate(async () => {
    job.status = "running";
    const ctx: JobContext = {
      jobId: job.id,
      setStage: (stage: string) => {
        job.stage = stage;
        if (!job.stagesCompleted.includes(stage)) {
          // mark the *previous* stage complete when a new one starts
        }
      },
      setProgress: (pct: number) => {
        job.progressPct = pct;
      },
    };

    try {
      await processor(payload, ctx);
      job.status = "completed";
      job.progressPct = 100;
    } catch (err) {
      job.status = "failed";
      job.error = (err as Error).message;
      logger.error("job_failed", { jobId: job.id, type, error: job.error });
    }
  });

  return job;
}

export function getJob(id: string): JobRecord | undefined {
  return jobs.get(id);
}

export function markStageComplete(jobId: string, stage: string) {
  const job = jobs.get(jobId);
  if (job && !job.stagesCompleted.includes(stage)) {
    job.stagesCompleted.push(stage);
  }
}
