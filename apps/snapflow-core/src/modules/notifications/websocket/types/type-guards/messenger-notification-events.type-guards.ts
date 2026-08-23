import {
  ALL_MESSENGER_NOTIFICATIONS_ROUTING_KEYS,
  MessengerNotificationsRoutingKey,
  NewMessageNotificationEvent,
} from '../../../../../../../../libs/contracts/messenger';

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null;
}

function isMessengerNotificationsRoutingKey(
  routingKey: string,
): routingKey is MessengerNotificationsRoutingKey {
  return ALL_MESSENGER_NOTIFICATIONS_ROUTING_KEYS.some((key) => key === routingKey);
}

export function parseMessengerNotificationsRoutingKey(
  routingKey: string,
): MessengerNotificationsRoutingKey | null {
  return isMessengerNotificationsRoutingKey(routingKey) ? routingKey : null;
}

export function isNewMessageNotificationEvent(
  payload: unknown,
): payload is NewMessageNotificationEvent {
  return (
    isRecord(payload) &&
    typeof payload.eventId === 'string' &&
    typeof payload.chatId === 'string' &&
    typeof payload.lastMessageId === 'string' &&
    typeof payload.senderId === 'number' &&
    typeof payload.recipientId === 'number' &&
    typeof payload.preview === 'string' &&
    typeof payload.missedCount === 'number' &&
    typeof payload.unreadTotal === 'number' &&
    typeof payload.sentAt === 'string'
  );
}
