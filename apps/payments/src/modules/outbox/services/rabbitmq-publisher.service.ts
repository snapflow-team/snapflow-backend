import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { ConfirmChannel } from 'amqplib';
import { RabbitMqExchanges } from '../constants/rabbitmq.constants';

@Injectable()
export class RabbitMQPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger = new Logger(RabbitMQPublisherService.name);

  private connection: AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  constructor(private readonly configService: ConfigService<Configuration, true>) {}

  async onModuleInit() {
    this.connect();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private connect() {
    const rebbitMqUrl: string = this.configService.get<ApiSettings>('apiSettings').rebbitMqUrl;

    this.connection = amqp.connect([rebbitMqUrl]);

    this.connection.on('connect', () => {
      this.logger.log('\x1b[36mSuccessfully connected to RabbitMQ\x1b[0m');
    });

    this.connection.on('disconnect', ({ err }) => {
      this.logger.error('Disconnected from RabbitMQ. Manager will try to reconnect...', err);
    });

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(RabbitMqExchanges.PAYMENTS, 'topic', { durable: true });
      },
    });
  }

  async publish(exchange: string, routingKey: string, payload: any): Promise<void> {
    try {
      await this.channelWrapper.publish(exchange, routingKey, payload, {
        persistent: true,
      });
    } catch (error) {
      this.logger.error(`Publish error to ${exchange} with key ${routingKey}:`, error);
      throw new Error(`Failed to publish to RabbitMQ: ${error.message}`);
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
      this.logger.log('\x1b[36mRabbitMQ connection gracefully closed\x1b[0m');
    } catch (e) {
      this.logger.error('Error during RabbitMQ shutdown', e);
    }
  }
}
