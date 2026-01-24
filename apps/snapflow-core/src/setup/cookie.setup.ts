import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function cookieSetup(app: INestApplication) {
  app.use(cookieParser());
}
