import { Chat, Message } from '@generated/prisma-messenger';

export type UserChatListItem = {
  chat: Chat;
  interlocutorId: number;
  lastMessage: Message | null;
  unreadCount: number;
};

export type FindUserChatsPaginatedParams = {
  cursor?: string;
  limit: number;
};

export type FindChatMessagesPaginatedParams = {
  cursor?: string;
  limit: number;
};
