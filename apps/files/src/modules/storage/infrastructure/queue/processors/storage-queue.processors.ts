import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProcessObjectService } from '../../../application/services/process-object.service';
import {
  DeleteObjectService,
  AbortMultipartService,
} from '../../../application/services/lifecycle.services';
import { STORAGE_JOB_NAMES, STORAGE_QUEUE_NAMES } from '../storage-queue.constants';

@Processor(STORAGE_QUEUE_NAMES.PROCESS_OBJECT)
export class ProcessObjectProcessor extends WorkerHost {
  constructor(private readonly processObjectService: ProcessObjectService) {
    super();
  }

  async process(job: Job<{ objectId: string }>): Promise<void> {
    if (job.name !== STORAGE_JOB_NAMES.PROCESS_OBJECT) {
      return;
    }

    await this.processObjectService.execute(job.data.objectId);
  }
}

@Processor(STORAGE_QUEUE_NAMES.DELETE_OBJECT)
export class DeleteObjectProcessor extends WorkerHost {
  constructor(private readonly deleteObjectService: DeleteObjectService) {
    super();
  }

  async process(job: Job<{ objectId: string }>): Promise<void> {
    if (job.name !== STORAGE_JOB_NAMES.DELETE_OBJECT) {
      return;
    }

    await this.deleteObjectService.execute(job.data.objectId);
  }
}

@Processor(STORAGE_QUEUE_NAMES.ABORT_MULTIPART)
export class AbortMultipartProcessor extends WorkerHost {
  constructor(private readonly abortMultipartService: AbortMultipartService) {
    super();
  }

  async process(job: Job<{ key: string; uploadId: string }>): Promise<void> {
    if (job.name !== STORAGE_JOB_NAMES.ABORT_MULTIPART) {
      return;
    }

    await this.abortMultipartService.execute(job.data);
  }
}
