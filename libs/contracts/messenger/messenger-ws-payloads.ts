/** Inbound: client → server (`typing.start` / `typing.stop`). */
export type TypingInboundPayload = {
  chatId: string;
};

/** Outbound: server → peer (`typing.start` / `typing.stop`). */
export type TypingOutboundPayload = {
  chatId: string;
  userId: string;
};

export type MessageReplyPreviewPayload = {
  id: string;
  senderId: string;
  text: string | null;
  deletedForEveryone: boolean;
};

export type NewMessagePayload = {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
  clientMessageId: string;
  createdAt: string;
  status: 'sent' | 'delivered' | 'read' | null;
  editedAt: string | null;
  deletedAt: string | null;
  deletedForEveryone: boolean;
  replyTo: MessageReplyPreviewPayload | null;
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
