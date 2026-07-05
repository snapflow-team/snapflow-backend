import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import configuration, { loadEnv, validate } from '../setup/configuration/configuration';

@Global()
@Module({
  imports: [
    CqrsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: loadEnv(),
    }),
  ],
  providers: [],
  exports: [CqrsModule],
})
export class CoreModule {}
