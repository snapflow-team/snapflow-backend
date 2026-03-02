import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

// todo: вынести в либу
export function cookieSetup(app: INestApplication) {
  app.use(cookieParser());
}
