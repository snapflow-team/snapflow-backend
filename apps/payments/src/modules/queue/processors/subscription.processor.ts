import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SubscriptionsJobsTypes } from '../types/subscriptions.jobs.types';
import { RabbitMQPublisherService } from '../../outbox/services/rabbitmq-publisher.service';
import {
  NotificationsRoutingKey,
  PAYMENTS_EXCHANGE,
} from '../../../../../../libs/contracts/payments';

@Processor('subscriptions-notifications')
export class SubscriptionProcessor extends WorkerHost {
  constructor(private readonly rabbitPublisher: RabbitMQPublisherService) {
    super();
  }
  async process(job: Job) {
    console.log('Job process!');
    console.log(job);
    switch (job.name) {
      case SubscriptionsJobsTypes.ACTIVATED:
        return this.handleActivatedJob(job);
      case SubscriptionsJobsTypes.EXPIRE_7D:
        return this.handleExpire7DJob(job);
      case SubscriptionsJobsTypes.EXPIRE_1D:
        return this.handleExpire1DJob(job);
      case SubscriptionsJobsTypes.PAYMENT_REMINDER_1D:
        return this.handlePayment1DJob(job);
      default:
        return;
    }
  }
  private async handleActivatedJob(job: Job<{ userId: number; createdAt: Date | string }>) {
    console.log('Job processed in queue processor');

    const createdAt: string =
      job.data.createdAt instanceof Date ? job.data.createdAt.toISOString() : job.data.createdAt;

    await this.rabbitPublisher.publish(
      PAYMENTS_EXCHANGE,
      NotificationsRoutingKey.SubscriptionActivated,
      {
        payload: {
          userId: job.data.userId,
          createdAt,
        },
      },
    );
  }
  private async handleExpire7DJob(job: Job) {}
  private async handleExpire1DJob(job: Job) {}
  private async handlePayment1DJob(job: Job) {}
}
