import { Worker } from 'worker_threads';
import path from 'path';
import { randomUUID } from 'crypto';

export interface DocumentWorkerTask {
  skillId: string;
  payload: Record<string, unknown>;
}

export interface DocumentWorkerProgress {
  message: string;
  progress?: number;
}

export interface DocumentWorkerResult {
  outputPath?: string;
  metadata?: Record<string, unknown>;
}

interface DocumentWorkerMessage {
  type: 'progress' | 'complete' | 'error';
  taskId: string;
  data?: DocumentWorkerResult | DocumentWorkerProgress;
  error?: string;
}

export function runDocumentWorker(
  task: DocumentWorkerTask,
  onProgress?: (progress: DocumentWorkerProgress) => void
): Promise<DocumentWorkerResult> {
  return new Promise((resolve, reject) => {
    const taskId = randomUUID();
    const workerPath = path.join(__dirname, 'document-worker.js');
    const worker = new Worker(workerPath, {
      workerData: {
        taskId,
        task,
      },
    });

    worker.on('message', (message: DocumentWorkerMessage) => {
      if (message.taskId !== taskId) return;
      if (message.type === 'progress') {
        if (onProgress && message.data) {
          onProgress(message.data as DocumentWorkerProgress);
        }
        return;
      }
      if (message.type === 'complete') {
        resolve((message.data as DocumentWorkerResult) || {});
        worker.terminate().catch(() => undefined);
        return;
      }
      if (message.type === 'error') {
        reject(new Error(message.error || 'Worker task failed'));
        worker.terminate().catch(() => undefined);
      }
    });

    worker.on('error', (error) => {
      reject(error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
