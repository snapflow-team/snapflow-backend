import { Global, Module, Scope } from '@nestjs/common';
import { CustomLogger } from './logger.service';
import { WinstonService } from './winston.service';
import { AsyncLocalStorageService } from '../../common/async-local-storage/async-local-storage.service';

@Global()
@Module({
  providers: [
    WinstonService,
    AsyncLocalStorageService,
    {
      provide: CustomLogger,
      scope: Scope.TRANSIENT,
      useFactory: (
        winstonLogger: WinstonService,
        asyncLocalStorageService: AsyncLocalStorageService,
      ) => new CustomLogger('', {}, winstonLogger, asyncLocalStorageService),
      inject: [WinstonService, AsyncLocalStorageService],
    },
  ],
  exports: [CustomLogger, AsyncLocalStorageService],
})
export class LoggerModule {}
