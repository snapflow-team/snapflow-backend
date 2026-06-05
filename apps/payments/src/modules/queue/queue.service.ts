import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SubscriptionsJobsTypes } from './types/subscriptions.jobs.types';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('subscriptions-notifications')
    private readonly queue: Queue,
  ) {}

  async addSubscriptionActivatedJob(payload: { userId: number; createdAt: Date }) {
    console.log('Job created in queue service');
    return await this.queue.add(SubscriptionsJobsTypes.ACTIVATED, payload, {
      //delay: 5_000,

      jobId: `activated-${payload.createdAt.toISOString()}`,
    });
  }
}
