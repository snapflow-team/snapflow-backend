import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { Configuration } from '../../setup/configuration/configuration';
import { ApiSettings } from '../../setup/configuration/api-settings';
import { ConfirmChannel } from 'amqplib';
import { PAYMENTS_EXCHANGE } from '../../../../../libs/contracts/payments';
import { AsyncLocalStorageService } from '../../common/async-local-storage/async-local-storage.service';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from '../../../../../libs/common/constants/request-id.constants';
import { LoggerFactory } from '../logger/logger.factory';
import { ContextLogger } from '../logger/context-logger';

@Injectable()
export class RabbitMQPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: ContextLogger;

  private connection: AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(RabbitMQPublisherService.name);
  }

  async onModuleInit() {
    this.connect();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private connect() {
    const rabbitMqUrl: string = this.configService.get<ApiSettings>('apiSettings').rabbitMqUrl;

    this.connection = amqp.connect([rabbitMqUrl]);

    this.connection.on('connect', () => {
      this.logger.log('Successfully connected to RabbitMQ', this.connect.name);
    });

    this.connection.on('disconnect', ({ err }) => {
      this.logger.error(
        err instanceof Error ? err : new Error('Disconnected from RabbitMQ'),
        this.connect.name,
      );
    });

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(PAYMENTS_EXCHANGE, 'topic', { durable: true });
      },
    });
  }

  async publish(exchange: string, routingKey: string, payload: unknown): Promise<void> {
    try {
      const requestIdValue: unknown = this.asyncLocalStorageService.getStore()?.get(REQUEST_ID_KEY);
      const requestId: string | undefined =
        typeof requestIdValue === 'string' ? requestIdValue : undefined;

      await this.channelWrapper.publish(exchange, routingKey, payload, {
        persistent: true,
        ...(requestId !== undefined ? { headers: { [REQUEST_ID_HEADER]: requestId } } : {}),
      });
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error : new Error(String(error)),
        this.publish.name,
      );
      throw new Error(
        `Failed to publish to RabbitMQ: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async close() {
    try {
      if (this.channelWrapper) {
        await this.channelWrapper.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('RabbitMQ connection gracefully closed', this.close.name);
    } catch (e) {
      this.logger.error(e, this.close.name);
    }
  }
}
