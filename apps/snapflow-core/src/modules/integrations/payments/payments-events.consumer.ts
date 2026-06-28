import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { Configuration } from '../../../setup/configuration/configuration';
import { PaymentsUserSyncService } from './payments-user-sync.service';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import {
  ALL_PAYMENTS_ROUTING_KEYS,
  PAYMENTS_EXCHANGE,
  PaymentsRoutingKey,
} from '../../../../../../libs/contracts/payments';
import { parsePaymentsRoutingKey } from './type-guards/payments-events.type-guards';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';
import { AsyncLocalStorageService } from '../../../common/async-local-storage/async-local-storage.service';
import { REQUEST_ID_KEY } from '../../../../../../libs/common/constants/request-id.constants';
import { extractRequestIdFromAmqpMsg } from '../../../../../../libs/common/messaging/amqp-headers';

@Injectable()
export class PaymentsEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger: ContextLogger;
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly paymentsUserSyncService: PaymentsUserSyncService,
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(PaymentsEventsConsumer.name);
  }

  onModuleInit(): void {
    const { rabbitMqUrl, paymentsEventsQueueName }: ApiSettings =
      this.configService.get<ApiSettings>('apiSettings');

    this.connection = amqp.connect([rabbitMqUrl]);

    this.connection.on('connect', () => {
      this.logger.log('Successfully connected to RabbitMQ', this.onModuleInit.name);
    });

    this.channelWrapper = this.connection.createChannel({
      json: false,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(PAYMENTS_EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(paymentsEventsQueueName, { durable: true });

        for (const key of ALL_PAYMENTS_ROUTING_KEYS) {
          await channel.bindQueue(paymentsEventsQueueName, PAYMENTS_EXCHANGE, key);
        }

        await channel.prefetch(1);

        await channel.consume(paymentsEventsQueueName, (msg: ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

          this.dispatchMessageWithRequestContext(channel, msg);
        });
      },
    });
    this.channelWrapper.on('error', (err) => {
      console.error('CHANNEL ERROR');
      console.error(err);
    });

    this.channelWrapper.on('close', () => {
      console.error('CHANNEL CLOSED in payments consumer');
    });
  }

  /**
   * Каждое AMQP-сообщение выполняется в своём ALS-контексте с requestId из headers
   * (или новым UUID), чтобы логи и вложенные сервисы видели тот же requestId.
   */
  private dispatchMessageWithRequestContext(channel: ConfirmChannel, msg: ConsumeMessage): void {
    const requestId: string = extractRequestIdFromAmqpMsg(msg) ?? randomUUID();

    this.asyncLocalStorageService.start(() => {
      this.asyncLocalStorageService.getStore()?.set(REQUEST_ID_KEY, requestId);
      void this.handleMessage(channel, msg);
    });
  }

  private async handleMessage(channel: ConfirmChannel, msg: ConsumeMessage): Promise<void> {
    try {
      const routingKey: string = msg.fields.routingKey;
      const payload: unknown = JSON.parse(msg.content.toString());
      const parsedRoutingKey: PaymentsRoutingKey | null = parsePaymentsRoutingKey(routingKey);

      if (!parsedRoutingKey) {
        this.logger.warn(`Unhandled routing key: ${routingKey}`);
        channel.ack(msg);
        return;
      }

      await this.paymentsUserSyncService.applyRoutingKey(parsedRoutingKey, payload);
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
