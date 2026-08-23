export const MESSENGER_EXCHANGE = 'messenger_exchange';

export enum MessengerNotificationsRoutingKey {
  NewMessage = 'NEW_MESSAGE_NOTIFICATION',
}

export const ALL_MESSENGER_NOTIFICATIONS_ROUTING_KEYS: readonly MessengerNotificationsRoutingKey[] =
  Object.values(MessengerNotificationsRoutingKey);
