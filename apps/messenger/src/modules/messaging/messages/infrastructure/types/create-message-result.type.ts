import { Message } from '@generated/prisma-messenger';

export type CreateMessageResult = {
  message: Message;
  isNew: boolean;
};

export type CreateMessageRow = Message & {
  isNew: boolean;
};
