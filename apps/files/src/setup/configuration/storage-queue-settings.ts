import { IsNumber, IsString, IsUrl, Min } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class StorageQueueSettings {
  @IsUrl({
    protocols: ['redis', 'rediss'],
    require_tld: false,
  })
  redisUrl: string;

  @IsString()
  queuePrefix: string;

  @IsNumber()
  @Min(1)
  imageWorkerConcurrency: number;

  @IsNumber()
  @Min(1)
  documentWorkerConcurrency: number;

  @IsNumber()
  @Min(1)
  ffmpegWorkerConcurrency: number;

  @IsNumber()
  @Min(100)
  outboxPollIntervalMs: number;

  @IsNumber()
  @Min(1)
  outboxBatchSize: number;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.redisUrl = environmentVariables.REDIS_URL;
    this.queuePrefix = environmentVariables.STORAGE_QUEUE_PREFIX;
    this.imageWorkerConcurrency = Number(environmentVariables.STORAGE_IMAGE_WORKER_CONCURRENCY);
    this.documentWorkerConcurrency = Number(
      environmentVariables.STORAGE_DOCUMENT_WORKER_CONCURRENCY,
    );
    this.ffmpegWorkerConcurrency = Number(environmentVariables.STORAGE_FFMPEG_WORKER_CONCURRENCY);
    this.outboxPollIntervalMs = Number(environmentVariables.STORAGE_OUTBOX_POLL_INTERVAL_MS);
    this.outboxBatchSize = Number(environmentVariables.STORAGE_OUTBOX_BATCH_SIZE);
  }
}
