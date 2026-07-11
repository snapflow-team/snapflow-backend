import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import configuration, { loadEnv, validate } from '../setup/configuration/configuration';
import { HttpModule } from '@nestjs/axios';
import { MessengerResultCodeMapper } from '../common/notification/messenger-result-code.mapper';

@Global()
@Module({
  imports: [
    HttpModule,
    CqrsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: loadEnv(),
    }),
  ],
  providers: [MessengerResultCodeMapper],
  exports: [HttpModule, CqrsModule, MessengerResultCodeMapper],
})
export class CoreModule {}
