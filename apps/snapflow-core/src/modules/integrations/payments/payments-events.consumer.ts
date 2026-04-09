import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { Configuration } from '../../../setup/configuration/configuration';
import { PaymentsUserSyncService } from './payments-user-sync.service';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import {
  ALL_PAYMENTS_ROUTING_KEYS,
  PAYMENTS_EXCHANGE,
  PaymentsRoutingKey,
} from '../../../../../../libs/contracts/payments';
import { parsePaymentsRoutingKey } from './type-guards/payments-events.type-guards';

@Injectable()
export class PaymentsEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger = new Logger(PaymentsEventsConsumer.name);
  private connection?: AmqpConnectionManager;
  private channelWrapper?: ChannelWrapper;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly paymentsUserSyncService: PaymentsUserSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { rabbitMqUrl, paymentsEventsQueueName }: ApiSettings =
      this.configService.get<ApiSettings>('apiSettings');

    this.connection = amqp.connect([rabbitMqUrl]);

    this.connection.on('connect', () => {
      this.logger.log('\x1b[36m✅Successfully connected to RabbitMQ\x1b[0m');
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

          void this.handleMessage(channel, msg);
        });
      },
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
      const message: string = error instanceof Error ? error.message : 'Unknown error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.error(`Payments event handling failed: ${message}`, errorStack);

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
      this.logger.error('Error closing RabbitMQ connection', error);
    }
  }
}
