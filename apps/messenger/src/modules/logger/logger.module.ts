import { Global, Module } from '@nestjs/common';
import { CustomLogger } from './logger.service';
import { WinstonService } from './winston.service';
import { AsyncLocalStorageService } from '../../common/async-local-storage/async-local-storage.service';
import { LoggerFactory } from './logger.factory';

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [CustomLogger, LoggerFactory, WinstonService, AsyncLocalStorageService],
  exports: [CustomLogger, LoggerFactory, AsyncLocalStorageService],
})
export class LoggerModule {}
