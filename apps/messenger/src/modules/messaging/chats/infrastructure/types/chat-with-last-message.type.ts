import { Prisma } from '@generated/prisma-messenger';

export type ChatWithLastMessage = Prisma.ChatGetPayload<{ include: { lastMessage: true } }>;
