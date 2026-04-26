import { Prisma } from '@generated/prisma-files';

export type CreateManyPendingFile = Pick<
  Prisma.FileCreateManyInput,
  'id' | 'userId' | 'key' | 'mimeType' | 'size'
>;
