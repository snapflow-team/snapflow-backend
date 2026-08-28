import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StorageOutboxEvent, StorageOutboxEventType } from '@generated/prisma-files';
import { ConfigService } from '@nestjs/config';
import { StorageOutboxRepository } from '../persistence/repositories/storage-outbox.repository';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { Configuration } from '../../../../setup/configuration/configuration';
import { StorageQueueSettings } from '../../../../setup/configuration/storage-queue-settings';
import { STORAGE_JOB_NAMES, STORAGE_QUEUE_NAMES } from './storage-queue.constants';

@Injectable()
export class StorageOutboxRelayService {
  private readonly logger: ContextLogger;
  private isProcessing = false;

  constructor(
    private readonly outboxRepository: StorageOutboxRepository,
    @InjectQueue(STORAGE_QUEUE_NAMES.PROCESS_OBJECT)
    private readonly processObjectQueue: Queue,
    @InjectQueue(STORAGE_QUEUE_NAMES.DELETE_OBJECT)
    private readonly deleteObjectQueue: Queue,
    @InjectQueue(STORAGE_QUEUE_NAMES.ABORT_MULTIPART)
    private readonly abortMultipartQueue: Queue,
    configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(StorageOutboxRelayService.name);
    const queueSettings = configService.get<StorageQueueSettings>('storageQueueSettings');
    this.batchSize = queueSettings.outboxBatchSize;
  }

  private readonly batchSize: number;

  @Cron(CronExpression.EVERY_5_SECONDS)
  async relayPendingEvents(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = await this.outboxRepository.lockEventsForProcessing(this.batchSize);

      for (const event of events) {
        await this.dispatchEvent(event);
      }
    } catch (error) {
      this.logger.error(error, this.relayPendingEvents.name);
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async recoverStaleEvents(): Promise<void> {
    const recovered = await this.outboxRepository.recoverStaleEvents(5);

    if (recovered > 0) {
      this.logger.warn(
        `Recovered ${recovered} stale storage outbox events`,
        this.recoverStaleEvents.name,
      );
    }
  }

  private async dispatchEvent(event: StorageOutboxEvent): Promise<void> {
    try {
      const payload = event.payload as Record<string, unknown>;

      switch (event.type) {
        case StorageOutboxEventType.PROCESS_OBJECT:
          await this.processObjectQueue.add(STORAGE_JOB_NAMES.PROCESS_OBJECT, payload, {
            jobId: `process:${payload.objectId as string}`,
          });
          break;
        case StorageOutboxEventType.DELETE_OBJECT:
          await this.deleteObjectQueue.add(STORAGE_JOB_NAMES.DELETE_OBJECT, payload, {
            jobId: `delete:${payload.objectId as string}:${Date.now()}`,
          });
          break;
        case StorageOutboxEventType.ABORT_MULTIPART:
          await this.abortMultipartQueue.add(STORAGE_JOB_NAMES.ABORT_MULTIPART, payload, {
            jobId: `abort:${payload.sessionId as string}`,
          });
          break;
        default: {
          const eventType = event.type as string;
          throw new Error(`Unknown storage outbox event type: ${eventType}`);
        }
      }

      await this.outboxRepository.markAsProcessed(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.outboxRepository.releaseToPending(event.id, message);
    }
  }
}
