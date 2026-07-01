import { NestFactory } from '@nestjs/core';
import { MessengerModule } from './messenger.module';

async function bootstrap() {
  const app = await NestFactory.create(MessengerModule);
  await app.listen(process.env.port ?? 5010);
}
bootstrap();
