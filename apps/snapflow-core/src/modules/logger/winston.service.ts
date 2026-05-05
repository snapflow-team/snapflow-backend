import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
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
const { combine, prettyPrint, timestamp, errors, colorize } = winston.format;

@Injectable()
export class WinstonService {
  private logger: winston.Logger;
  private serviceName = 'snapflow-core';

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const loggerSettings: LoggerSettings = this.configService.get<LoggerSettings>('loggerSettings');
    const environmentSettings: EnvironmentSettings =
      this.configService.get<EnvironmentSettings>('environmentSettings');

    const consoleTransport = new winston.transports.Console({
      format: environmentSettings.isProduction
        ? combine(timestamp({ format: timeFormat }), errors({ stack: true }), winston.format.json())
        : combine(
            timestamp({ format: timeFormat }),
            errors({ stack: true }),
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

  trace(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
  ): void {
    this.logger.log('trace', message, {
      sourceName,
      functionName,
      requestId,
    });
  }

  debug(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
  ): void {
    this.logger.debug(message, {
      sourceName,
      functionName,
      requestId,
    });
  }

  info(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
  ): void {
    this.logger.info(message, {
      sourceName,
      functionName,
      requestId,
    });
  }

  warn(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
  ): void {
    this.logger.warn(message, {
      sourceName,
      functionName,
      requestId,
    });
  }

  error(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
    stack?: string,
  ): void {
    this.logger.error(message, {
      sourceName,
      functionName,
      requestId,
      stack,
    });
  }

  fatal(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
    stack?: string,
  ): void {
    this.logger.log(
      'fatal',
      message,
      {
        sourceName,
        functionName,
        requestId,
        stack,
      },
    );
  }
}
