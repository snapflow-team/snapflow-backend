export interface NewMessageNotificationEvent {
  eventId: string;
  chatId: string;
  lastMessageId: string;
  senderId: number;
  recipientId: number;
  preview: string;
  missedCount: number;
  unreadTotal: number;
  sentAt: string;
}
