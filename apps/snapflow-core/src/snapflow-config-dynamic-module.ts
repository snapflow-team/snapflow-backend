import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

// you must import this const in the head of your app.module.ts
export const snapFlowConfigDynamicModule = ConfigModule.forRoot({
  envFilePath: [
    process.env.ENV_FILE_PATH?.trim() || '',
    join(process.cwd(), 'env', `.env.${process.env.NODE_ENV}.local`),
    join(process.cwd(), 'env', `.env.${process.env.NODE_ENV}`),
    join(process.cwd(), 'env', '.env.production'),
  ],
  isGlobal: true,
});
