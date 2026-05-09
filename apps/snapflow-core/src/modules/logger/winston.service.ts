import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { AsyncLocalStorageService } from '../../common/async-local-storage/async-local-storage.service';
import { REQUEST_ID_KEY } from '../../common/middleware/request-context.middleware';
import { Configuration } from '../../setup/configuration/configuration';
import { EnvironmentSettings } from '../../setup/configuration/environment-settings';
import { LoggerLevel, LoggerSettings } from '../../setup/configuration/logger-settings';

const LOG_LEVELS: Record<LoggerLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const timeFormat = 'YYYY-MM-DD HH:mm:ss';
const { combine, prettyPrint, timestamp, colorize } = winston.format;

@Injectable()
export class WinstonService {
  private logger: winston.Logger;
  private serviceName = 'snapflow-core';

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
  ) {
    const loggerSettings: LoggerSettings = this.configService.get<LoggerSettings>('loggerSettings');
    const environmentSettings: EnvironmentSettings =
      this.configService.get<EnvironmentSettings>('environmentSettings');

    const consoleTransport = new winston.transports.Console({
      format: environmentSettings.isProduction
        ? combine(timestamp({ format: timeFormat }), winston.format.json())
        : combine(
            timestamp({ format: timeFormat }),
            prettyPrint(),
            colorize({ all: true, colors: { trace: 'yellow' } }),
          ),
    });

    this.logger = winston.createLogger({
      format: winston.format.timestamp({ format: timeFormat }),
      level: loggerSettings.level,
      levels: LOG_LEVELS,
      transports: [consoleTransport],
      defaultMeta: { serviceName: this.serviceName },
    });
  }

  private getRequestId(): string | null {
    return this.asyncLocalStorageService.getStore()?.get(REQUEST_ID_KEY) ?? null;
  }

  trace(message: string, sourceName?: string, functionName?: string): void {
    this.logger.log('trace', message, {
      sourceName,
      functionName,
      requestId: this.getRequestId(),
    });
  }

  debug(message: string, sourceName?: string, functionName?: string): void {
    this.logger.debug(message, {
      sourceName,
      functionName,
      requestId: this.getRequestId(),
    });
  }

  info(message: string, sourceName?: string, functionName?: string): void {
    this.logger.info(message, {
      sourceName,
      functionName,
      requestId: this.getRequestId(),
    });
  }

  warn(message: string, sourceName?: string, functionName?: string): void {
    this.logger.warn(message, {
      sourceName,
      functionName,
      requestId: this.getRequestId(),
    });
  }

  error(
    message: string,
    sourceName?: string,
    functionName?: string,
    stack?: string,
  ): void {
    this.logger.error(message, {
      sourceName,
      functionName,
      requestId: this.getRequestId(),
      stack,
    });
  }

  fatal(
    message: string,
    sourceName?: string,
    functionName?: string,
    stack?: string,
  ): void {
    this.logger.log(
      'fatal',
      message,
      {
        sourceName,
        functionName,
        requestId: this.getRequestId(),
        stack,
      },
    );
  }
}
