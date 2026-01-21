// you must import this const in the head of your app.module.ts
import { join } from 'path';

if (!process.env.NODE_ENV) {
  throw new Error('NODE_ENV is required');
}

export const envFilePaths = [
  process.env.ENV_FILE_PATH?.trim() || '',
  join(process.cwd(), 'env', `.env.${process.env.NODE_ENV}.local`),
  join(process.cwd(), 'env', `.env.${process.env.NODE_ENV}`),
  join(process.cwd(), 'env', '.env.production'),
];
