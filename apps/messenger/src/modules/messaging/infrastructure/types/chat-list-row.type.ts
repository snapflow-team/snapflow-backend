export type ChatListRow = {
  id: number;
  participantAId: number;
  participantBId: number;
  chatLastMessageId: number | null;
  chatLastMessageAt: Date | null;
  chatCreatedAt: Date;
  chatUpdatedAt: Date;
  messageId: number | null;
  messageChatId: number | null;
  messageSenderId: number | null;
  messageText: string | null;
  messageCreatedAt: Date | null;
  unreadCount: number;
};
