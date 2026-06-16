import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SubscriptionsJobsTypes } from '../types/subscriptions.jobs.types';
import { RabbitMQPublisherService } from '../../rabbitmq/rabbitmq-publisher.service';
import {
  NotificationsRoutingKey,
  PAYMENTS_EXCHANGE,
} from '../../../../../../libs/contracts/payments';
import {
  PaymentReminderJobPayload,
  SubscriptionJobPayload,
} from '../types/subscriptions-jobs-payload.type';
import { SubscriptionActivatedNotificationEvent } from '../../../../../../libs/contracts/payments/notifications/payment-subscription-activated-notification.event';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';
import { PaymentSubscriptionExpiring7dNotificationEvent } from '../../../../../../libs/contracts/payments/notifications/payment-subscription-expiring-7d-notification.event';
import { PaymentSubscriptionExpiring1dNotificationEvent } from '../../../../../../libs/contracts/payments/notifications/payment-subscription-expiring-1d-notification.event';
import { PaymentSubscriptionNextPayment1dNotificationEvent } from '../../../../../../libs/contracts/payments/notifications/payment-subscription-next-payment-1d-notification.event';

@Processor('subscriptions-notifications')
export class SubscriptionQueueProcessor extends WorkerHost {
  private readonly logger: ContextLogger;
  constructor(
    private readonly rabbitPublisher: RabbitMQPublisherService,
    private loggerFactory: LoggerFactory,
  ) {
    super();
    this.logger = this.loggerFactory.create(SubscriptionQueueProcessor.name);
  }

  async process(job: Job) {
    console.log('job in processor: ', job.name);
    try {
      switch (job.name) {
        case SubscriptionsJobsTypes.ACTIVATED:
          await this.handleActivatedJob(job);
          break;

        case SubscriptionsJobsTypes.EXPIRE_7D:
          await this.handleExpire7DJob(job);
          break;

        case SubscriptionsJobsTypes.EXPIRE_1D:
          await this.handleExpire1DJob(job);
          break;

        case SubscriptionsJobsTypes.PAYMENT_REMINDER_1D:
          await this.handleNextPayment1DJob(job);
          break;
        default:
          this.logger.log(`Unhandled job ${job.name}, jobId: ${job.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Publishing event was unsuccessful for job ${job.name}, jobId: ${job.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async handleActivatedJob(job: Job<SubscriptionJobPayload>) {
    console.log('job in processor: ', job.name, 'published to rabbitmq');
    await this.rabbitPublisher.publish(
      PAYMENTS_EXCHANGE,
      NotificationsRoutingKey.SubscriptionActivated,
      {
        userId: job.data.userId,
        expireAt: job.data.expireAt,
      } satisfies SubscriptionActivatedNotificationEvent,
    );
  }

  private async handleExpire7DJob(job: Job<SubscriptionJobPayload>) {
    await this.rabbitPublisher.publish(
      PAYMENTS_EXCHANGE,
      NotificationsRoutingKey.SubscriptionExpiringIn7Days,
      {
        userId: job.data.userId,
        expireAt: job.data.expireAt,
      } satisfies PaymentSubscriptionExpiring7dNotificationEvent,
    );
  }

  private async handleExpire1DJob(job: Job<SubscriptionJobPayload>) {
    await this.rabbitPublisher.publish(
      PAYMENTS_EXCHANGE,
      NotificationsRoutingKey.SubscriptionExpiringIn1Day,
      {
        userId: job.data.userId,
        expireAt: job.data.expireAt,
      } satisfies PaymentSubscriptionExpiring1dNotificationEvent,
    );
  }

  private async handleNextPayment1DJob(job: Job<PaymentReminderJobPayload>) {
    await this.rabbitPublisher.publish(
      PAYMENTS_EXCHANGE,
      NotificationsRoutingKey.NextPaymentReminderIn1Day,
      {
        userId: job.data.userId,
        nextPaymentAt: job.data.nextPaymentAt,
      } satisfies PaymentSubscriptionNextPayment1dNotificationEvent,
    );
  }
}
