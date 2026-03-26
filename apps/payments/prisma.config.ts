import { defineConfig } from '@prisma/config';
import { config } from 'dotenv';
import { loadEnv } from './src/setup/configuration/configuration';

config({
  path: loadEnv(),
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
