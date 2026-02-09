import { parentPort, workerData } from 'worker_threads';

if (!parentPort) {
  process.exit(1);
}

const taskId = typeof workerData?.taskId === 'string' ? workerData.taskId : 'unknown';

parentPort.postMessage({
  type: 'error',
  taskId,
  error: 'Document worker not implemented',
});
