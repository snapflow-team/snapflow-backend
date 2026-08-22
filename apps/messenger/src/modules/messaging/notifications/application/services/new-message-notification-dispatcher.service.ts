import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Message, OutboxEvent, OutboxEventType } from '@generated/prisma-messenger';
import {
  MESSENGER_EXCHANGE,
  MessengerNotificationsRoutingKey,
  NewMessageNotificationEvent,
} from '@contracts/messenger';
import { ContextLogger } from '../../../../logger/context-logger';
import { LoggerFactory } from '../../../../logger/logger.factory';
import { OutboxProcessing } from '../../../../outbox/constants/outbox.constants';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { RabbitMQPublisherService } from '../../../../rabbitmq/rabbitmq-publisher.service';
import { BusinessRulesSettings } from '../../../../../setup/configuration/business-rules-settings';
import { Configuration } from '../../../../../setup/configuration/configuration';
import { ChatsQueryRepository } from '../../../infrastructure/query/chats.query-repository';
import { NewMessageNotificationDecision, NewMessageNotificationPolicy, } from './new-message-notification.policy';

type NewMessageOutboxPayload = {
  chatId: number;
  messageId: number;
  senderId: number;
  recipientId: number;
};

type NotificationGroup = {
  recipientId: number;
  chatId: number;
  events: OutboxEvent[];
  latest: NewMessageOutboxPayload;
  missedCount: number;
};

type GroupedNotificationEvents = {
  groups: NotificationGroup[];
  ungroupedEventIds: string[];
};

@Injectable()
export class NewMessageNotificationDispatcherService {
  private readonly logger: ContextLogger;
  private isProcessing: boolean = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly policy: NewMessageNotificationPolicy,
    private readonly chatsQueryRepository: ChatsQueryRepository,
    private readonly rabbitPublisher: RabbitMQPublisherService,
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(NewMessageNotificationDispatcherService.name);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async dispatchPendingNotifications(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const events: OutboxEvent[] = await this.outboxRepository.lockEventsForProcessing(
        OutboxEventType.NEW_MESSAGE_NOTIFICATION,
        OutboxProcessing.LOCK_BATCH_SIZE,
      );

      if (events.length === 0) {
        return;
      }

      this.logger.debug(
        `Found ${events.length} pending notification outbox events. Processing...`,
        this.dispatchPendingNotifications.name,
      );

      const { groups, ungroupedEventIds } = this.groupByRecipientAndChat(events);

      if (ungroupedEventIds.length > 0) {
        await Promise.all(
          ungroupedEventIds.map((id) => this.outboxRepository.markAsSkipped(id, 'invalid_payload')),
        );
      }

      for (const group of groups) {
        await this.processGroup(group);
      }
    } catch (error) {
      this.logger.error(error, this.dispatchPendingNotifications.name);
    } finally {
      this.isProcessing = false;
    }
  }

  private groupByRecipientAndChat(events: OutboxEvent[]): GroupedNotificationEvents {
    const groups = new Map<string, NotificationGroup>();
    const ungroupedEventIds: string[] = [];

    for (const event of events) {
      const payload: NewMessageOutboxPayload | null = this.parsePayload(event.payload);
      if (!payload) {
        ungroupedEventIds.push(event.id);
        continue;
      }

      const key = `${payload.recipientId}:${payload.chatId}`;
      const existing: NotificationGroup | undefined = groups.get(key);

      if (!existing) {
        groups.set(key, {
          recipientId: payload.recipientId,
          chatId: payload.chatId,
          events: [event],
          latest: payload,
          missedCount: 1,
        });
        continue;
      }

      existing.events.push(event);
      existing.missedCount += 1;
      if (payload.messageId > existing.latest.messageId) {
        existing.latest = payload;
      }
    }

    return {
      groups: [...groups.values()],
      ungroupedEventIds,
    };
  }

  private async processGroup(group: NotificationGroup): Promise<void> {
    const decision: NewMessageNotificationDecision = await this.policy.shouldNotify({
      chatId: group.chatId,
      messageId: group.latest.messageId,
      recipientId: group.recipientId,
    });

    if (!decision.shouldNotify) {
      await Promise.all(
        group.events.map((event) => this.outboxRepository.markAsSkipped(event.id, decision.reason)),
      );
      return;
    }

    try {
      const unreadTotal: number = await this.chatsQueryRepository.getTotalUnreadCount(
        group.recipientId,
      );
      const previewMaxLength: number =
        this.configService.get<BusinessRulesSettings>('businessRulesSettings').pushPreviewMaxLength;

      const payload: NewMessageNotificationEvent = {
        eventId: randomUUID(),
        chatId: String(group.chatId),
        lastMessageId: String(group.latest.messageId),
        senderId: group.latest.senderId,
        recipientId: group.recipientId,
        preview: this.buildPreview(decision.message, previewMaxLength),
        missedCount: group.missedCount,
        unreadTotal,
        sentAt: decision.message.createdAt.toISOString(),
      };

      await this.rabbitPublisher.publish(
        MESSENGER_EXCHANGE,
        MessengerNotificationsRoutingKey.NewMessage,
        payload,
      );

      await Promise.all(
        group.events.map((event) => this.outboxRepository.markAsProcessed(event.id)),
      );
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown broker error';
      this.logger.error(
        error instanceof Error ? error : new Error(errorMessage),
        this.processGroup.name,
      );

      await Promise.all(
        group.events.map((event) => this.outboxRepository.releaseToPending(event.id, errorMessage)),
      );
    }
  }

  private parsePayload(payload: unknown): NewMessageOutboxPayload | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const { chatId, messageId, senderId, recipientId } = record;

    if (
      typeof chatId !== 'number' ||
      typeof messageId !== 'number' ||
      typeof senderId !== 'number' ||
      typeof recipientId !== 'number'
    ) {
      return null;
    }

    return { chatId, messageId, senderId, recipientId };
  }

  private buildPreview(message: Message, maxLength: number): string {
    if (message.text.length <= maxLength) {
      return message.text;
    }

    return message.text.slice(0, maxLength);
  }
}
