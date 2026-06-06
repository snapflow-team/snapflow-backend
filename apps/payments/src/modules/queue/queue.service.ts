import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SubscriptionsJobsTypes } from './types/subscriptions.jobs.types';
import { SubscriptionsJobsDelays } from './constants/query.constants';
import {
  PaymentReminderJobPayload,
  SubscriptionJobPayload,
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

  async addSubscriptionActivatedJob(payload: SubscriptionJobPayload) {
    console.log('Job created in queue service');

    await this.queue.add(SubscriptionsJobsTypes.ACTIVATED, payload, {
      delay: SubscriptionsJobsDelays.SubscriptionActivatedDelayInMs,

      jobId: createJobId(SubscriptionsJobsTypes.ACTIVATED, payload.userId, payload.expireAt),
    });
  }
  async addExpiringSubscription7DaysJob(payload: SubscriptionJobPayload) {
    return await this.queue.add(SubscriptionsJobsTypes.EXPIRE_7D, payload, {
      delay: this.dateService.getDelayForJob(
        new Date(payload.expireAt),
        SubscriptionsJobsDelays.SubscriptionExpiring7DaysDelay,
      ),

      jobId: createJobId(SubscriptionsJobsTypes.EXPIRE_7D, payload.userId, payload.expireAt),
    });
  }
  async addExpiringSubscription1DayJob(payload: SubscriptionJobPayload) {
    return await this.queue.add(SubscriptionsJobsTypes.EXPIRE_1D, payload, {
      delay: this.dateService.getDelayForJob(
        new Date(payload.expireAt),
        SubscriptionsJobsDelays.SubscriptionExpiring1DayDelay,
      ),

      jobId: createJobId(SubscriptionsJobsTypes.EXPIRE_1D, payload.userId, payload.expireAt),
    });
  }
  async addPaymentSubscriptionReminder1DayJob(payload: PaymentReminderJobPayload) {
    return await this.queue.add(SubscriptionsJobsTypes.PAYMENT_REMINDER_1D, payload, {
      delay: this.dateService.getDelayForJob(
        new Date(payload.nextPaymentAt),
        SubscriptionsJobsDelays.SubscriptionNextPayment1DayDelay,
      ),

      jobId: createJobId(
        SubscriptionsJobsTypes.PAYMENT_REMINDER_1D,
        payload.userId,
        payload.nextPaymentAt,
      ),
    });
  }
}
