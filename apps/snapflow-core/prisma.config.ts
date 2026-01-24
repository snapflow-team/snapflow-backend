import { defineConfig } from '@prisma/config';
import { config } from 'dotenv';
import { envFilePaths } from '../../env-file-paths';

config({
  path: envFilePaths,
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
