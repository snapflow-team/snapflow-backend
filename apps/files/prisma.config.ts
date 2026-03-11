import { defineConfig } from '@prisma/config';
import { config } from 'dotenv';
import { join } from 'path';

const nodeEnv = process.env.NODE_ENV;

if (!nodeEnv) {
  throw new Error('NODE_ENV is required');
}

config({
  path: [
    process.env.ENV_FILE_PATH?.trim() || '',
    join(__dirname, 'env', `.env.${nodeEnv}.local`),
    join(__dirname, 'env', `.env.${nodeEnv}`),
    join(__dirname, 'env', '.env.production'),
  ],
});

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
