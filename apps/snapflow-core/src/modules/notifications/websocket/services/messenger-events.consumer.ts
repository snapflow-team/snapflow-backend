import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import {
  ALL_MESSENGER_NOTIFICATIONS_ROUTING_KEYS,
  MESSENGER_EXCHANGE,
} from '../../../../../../../libs/contracts/messenger';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { AsyncLocalStorageService } from '../../../../common/async-local-storage/async-local-storage.service';
import { REQUEST_ID_KEY } from '../../../../../../../libs/common/constants/request-id.constants';
import { extractRequestIdFromAmqpMsg } from '../../../../../../../libs/common/messaging/amqp-headers';
import { parseMessengerNotificationsRoutingKey } from '../types/type-guards/messenger-notification-events.type-guards';
import { MessengerNotificationService } from './messenger-notification.service';

@Injectable()
export class MessengerEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger: ContextLogger;
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;
  private messengerEventsQueueName?: string;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly messengerNotificationService: MessengerNotificationService,
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(MessengerEventsConsumer.name);
  }

  onModuleInit(): void {
    const { rabbitMqUrl, messengerEventsQueueName }: ApiSettings =
      this.configService.get<ApiSettings>('apiSettings');

    this.messengerEventsQueueName = messengerEventsQueueName;

    this.connection = amqp.connect([rabbitMqUrl]);

    this.connection.on('connect', () => {
      this.logger.log('Successfully connected to RabbitMQ', this.onModuleInit.name);
    });

    this.connection.on('disconnect', (params) => {
      this.logger.error(
        params.err instanceof Error ? params.err : new Error('Disconnected from RabbitMQ'),
        this.onModuleInit.name,
      );
    });

    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(MESSENGER_EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(messengerEventsQueueName, { durable: true });

        for (const key of ALL_MESSENGER_NOTIFICATIONS_ROUTING_KEYS) {
          await channel.bindQueue(messengerEventsQueueName, MESSENGER_EXCHANGE, key);
        }

        await channel.prefetch(1);

        await channel.consume(messengerEventsQueueName, (msg: ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

          this.dispatchMessageWithRequestContext(channel, msg);
        });
      },
    });

    this.channelWrapper.on('error', (err) => {
      this.logger.error(
        err instanceof Error ? err : new Error(String(err)),
        this.onModuleInit.name,
      );
    });

    this.channelWrapper.on('close', () => {
      this.logger.warn('RabbitMQ channel closed', this.onModuleInit.name);
    });
  }

  private dispatchMessageWithRequestContext(channel: ConfirmChannel, msg: ConsumeMessage): void {
    const requestId: string = extractRequestIdFromAmqpMsg(msg) ?? randomUUID();

    this.asyncLocalStorageService.start(() => {
      this.asyncLocalStorageService.getStore()?.set(REQUEST_ID_KEY, requestId);
      void this.handleMessage(channel, msg);
    });
  }

  private async handleMessage(channel: ConfirmChannel, msg: ConsumeMessage): Promise<void> {
    const routingKey: string = msg.fields.routingKey;

    try {
      const payload: unknown = JSON.parse(msg.content.toString());
      const parsedRoutingKey = parseMessengerNotificationsRoutingKey(routingKey);

      if (!parsedRoutingKey) {
        this.logger.warn(
          `Unhandled routing key "${routingKey}" on queue "${this.messengerEventsQueueName ?? 'unknown'}"`,
          this.handleMessage.name,
        );
        channel.ack(msg);
        return;
      }

      await this.messengerNotificationService.applyRoutingKey(parsedRoutingKey, payload);

      channel.ack(msg);
    } catch (error) {
      this.logger.error(error, this.handleMessage.name);

      channel.nack(msg, false, true);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.channelWrapper) {
        await this.channelWrapper.close();
      }

      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      this.logger.error(error, this.onModuleDestroy.name);
    }
  }
}
