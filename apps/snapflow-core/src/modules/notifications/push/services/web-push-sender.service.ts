import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { PushSubscriptionsRepository } from '../repositories/push-subscriptions.repository';
import { NewMessageWebPushPayload } from '../types/new-message-web-push-payload.type';
import { PushSubscription } from '@generated/prisma-snapflow';

@Injectable()
export class WebPushSenderService implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly pushSubscriptionsRepository: PushSubscriptionsRepository,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(WebPushSenderService.name);
  }

  onModuleInit(): void {
    const { vapidSubject, vapidPublicKey, vapidPrivateKey }: ApiSettings =
      this.configService.get<ApiSettings>('apiSettings');

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

  async sendToUser(userId: number, payload: NewMessageWebPushPayload): Promise<void> {
    const subscriptions: PushSubscription[] =
      await this.pushSubscriptionsRepository.findByUserId(userId);

    if (subscriptions.length === 0) {
      return;
    }

    const body: string = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            body,
          );

          await this.pushSubscriptionsRepository.touchLastUsedAt(subscription.endpoint);
        } catch (error) {
          const statusCode = this.extractStatusCode(error);

          if (statusCode === 404 || statusCode === 410) {
            await this.pushSubscriptionsRepository.deleteByEndpointOnly(subscription.endpoint);
            this.logger.warn(
              `Removed expired push subscription (status ${statusCode}): ${subscription.endpoint}`,
              this.sendToUser.name,
            );

            return;
          }

          this.logger.error(error, this.sendToUser.name);
        }
      }),
    );
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode: unknown }).statusCode === 'number'
    ) {
      return (error as { statusCode: number }).statusCode;
    }

    return undefined;
  }
}
