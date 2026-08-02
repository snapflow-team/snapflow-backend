/** Inbound: client → server (`typing.start` / `typing.stop`). */
export type TypingInboundPayload = {
  chatId: string;
};

/** Outbound: server → peer (`typing.start` / `typing.stop`). */
export type TypingOutboundPayload = {
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

export type ChatUpdatedPayload = {
  chatId: string;
  unreadCount: number;
};

export type UnreadUpdatedPayload = {
  total: number;
};

export type MessageDeletedPayload = {
  messageId: string;
  chatId: string;
  scope: 'me' | 'everyone';
};

export type PresenceUpdatedPayload = {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
};
