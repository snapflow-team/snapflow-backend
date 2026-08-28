export const STORAGE_REDIS = Symbol('STORAGE_REDIS');

export const STORAGE_QUEUE_NAMES = {
  PROCESS_OBJECT: 'storage-process-object',
  DELETE_OBJECT: 'storage-delete-object',
  ABORT_MULTIPART: 'storage-abort-multipart',
} as const;

export const STORAGE_JOB_NAMES = {
  PROCESS_OBJECT: 'process-object',
  DELETE_OBJECT: 'delete-object',
  ABORT_MULTIPART: 'abort-multipart',
} as const;
