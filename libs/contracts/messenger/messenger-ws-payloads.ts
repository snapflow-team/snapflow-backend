export type TypingPayload = {
  chatId: string;
  userId: string;
};

export type MessageDeliveredPayload = {
  messageId: string;
};

export type MessageReadPayload = {
  chatId: string;
  lastReadMessageId: string;
  readByUserId: string;
  readAt: string;
};

export type MessageDeletedPayload = {
  messageId: string;
  chatId: string;
  scope: 'me' | 'everyone';
};
