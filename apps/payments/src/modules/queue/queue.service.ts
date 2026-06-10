import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SubscriptionsJobsTypes } from './types/subscriptions.jobs.types';
import { SubscriptionsJobsDelays } from './constants/query.constants';
import {
  PaymentReminderJobPayload,
  SubscriptionJobPayload,
  SubscriptionNotificationPayload,
} from './types/subscriptions-jobs-payload.type';
import { DateService } from '../../../../../libs/common/services/date.service';
import { createJobId } from './utils/create-job.id';
import { LoggerFactory } from '../logger/logger.factory';
import { ContextLogger } from '../logger/context-logger';

@Injectable()
export class QueueService {
  private readonly logger: ContextLogger;
  constructor(
    @InjectQueue('subscriptions-notifications')
    private readonly queue: Queue,
    private dateService: DateService,
    private loggerFactory: LoggerFactory,
  ) {
    this.logger = this.loggerFactory.create(QueueService.name);
  }
  async addSubscriptionNotifications(payload: SubscriptionNotificationPayload) {
    const { userId, expireAt, nextPaymentAt, subscriptionId } = payload;
    try {
      await Promise.all([
        this.addSubscriptionActivatedJob({ userId, expireAt }, subscriptionId),
        this.addExpiringSubscription7DaysJob({ userId, expireAt }, subscriptionId),
        this.addExpiringSubscription1DayJob({ userId, expireAt }, subscriptionId),
        this.addPaymentSubscriptionReminder1DayJob({ userId, nextPaymentAt }, subscriptionId),
      ]);
    } catch (error) {
      this.logger.error(error, 'Failed to schedule subscription jobs');
      throw error;
    }
  }

  private async addSubscriptionActivatedJob(
    payload: SubscriptionJobPayload,
    subscriptionId: number,
  ) {
    const jobId = await this.resetJob(SubscriptionsJobsTypes.ACTIVATED, subscriptionId);

    await this.queue.add(SubscriptionsJobsTypes.ACTIVATED, payload, {
      delay: SubscriptionsJobsDelays.SubscriptionActivatedDelayInMs,
      jobId,
    });
  }
  private async addExpiringSubscription7DaysJob(
    payload: SubscriptionJobPayload,
    subscriptionId: number,
  ) {
    const jobId = await this.resetJob(SubscriptionsJobsTypes.EXPIRE_7D, subscriptionId);

    return await this.queue.add(SubscriptionsJobsTypes.EXPIRE_7D, payload, {
      delay: this.dateService.getDelayForJob(
        payload.expireAt,
        SubscriptionsJobsDelays.SubscriptionExpiring7DaysDelay,
      ),
      jobId,
    });
  }
  private async addExpiringSubscription1DayJob(
    payload: SubscriptionJobPayload,
    subscriptionId: number,
  ) {
    const jobId = await this.resetJob(SubscriptionsJobsTypes.EXPIRE_1D, subscriptionId);

    return await this.queue.add(SubscriptionsJobsTypes.EXPIRE_1D, payload, {
      delay: this.dateService.getDelayForJob(
        payload.expireAt,
        SubscriptionsJobsDelays.SubscriptionExpiring1DayDelay,
      ),
      jobId,
    });
  }
  async addPaymentSubscriptionReminder1DayJob(
    payload: PaymentReminderJobPayload,
    subscriptionId: number,
  ) {
    const jobId = await this.resetJob(SubscriptionsJobsTypes.PAYMENT_REMINDER_1D, subscriptionId);

    return await this.queue.add(SubscriptionsJobsTypes.PAYMENT_REMINDER_1D, payload, {
      delay: this.dateService.getDelayForJob(
        payload.nextPaymentAt,
        SubscriptionsJobsDelays.SubscriptionNextPayment1DayDelay,
      ),
      jobId,
    });
  }

  async resetJob(jobType: SubscriptionJobType, subscriptionId: number) {
    const jobId = createJobId(jobType, subscriptionId);

    const oldJob = await this.queue.getJob(jobId);
    if (oldJob) {
      await oldJob.remove();
    }

    return jobId;
  }
}
type SubscriptionJobType = (typeof SubscriptionsJobsTypes)[keyof typeof SubscriptionsJobsTypes];
