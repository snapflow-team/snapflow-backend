import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { Configuration } from '../../setup/configuration/configuration';
import { LoggerLevel, LoggerSettings } from '../../setup/configuration/logger-settings';

const LOG_LEVELS: Record<LoggerLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

type LogMeta = {
  requestId?: string | null;
  functionName?: string;
  sourceName?: string;
  stack?: string;
};

@Injectable()
export class WinstonService {
  private readonly logger: winston.Logger;
  private readonly serviceName = 'snapflow-core';

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const loggerSettings: LoggerSettings = this.configService.get<LoggerSettings>('loggerSettings');
    const timeFormat = 'YYYY-MM-DD HH:mm:ss';
    const { combine, prettyPrint, timestamp, errors, colorize } = winston.format;

    const consoleTransport = new winston.transports.Console({
      format: combine(
        timestamp({ format: timeFormat }),
        errors({ stack: true }),
        prettyPrint(),
        colorize({ all: true, colors: { trace: 'yellow' } }),
      ),
    });

    this.logger = winston.createLogger({
      levels: LOG_LEVELS,
      level: loggerSettings.level,
      defaultMeta: { serviceName: this.serviceName },
      format: winston.format.timestamp({ format: timeFormat }),
      transports: [consoleTransport],
    });
  }

  trace(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
  ): void {
    this.write('trace', message, { requestId, functionName, sourceName });
  }

  debug(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
  ): void {
    this.write('debug', message, { requestId, functionName, sourceName });
  }

  info(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
  ): void {
    this.write('info', message, { requestId, functionName, sourceName });
  }

  warn(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
  ): void {
    this.write('warn', message, { requestId, functionName, sourceName });
  }

  error(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
    stack?: string,
  ): void {
    this.write('error', message, { requestId, functionName, sourceName, stack });
  }

  fatal(
    message: string,
    requestId: string | null,
    functionName?: string,
    sourceName?: string,
    stack?: string,
  ): void {
    this.logger.log('fatal', message, this.cleanMeta({ requestId, functionName, sourceName, stack }));
  }

  private write(level: LoggerLevel, message: unknown, meta: LogMeta): void {
    this.logger.log({
      level,
      message: this.stringifyMessage(message),
      ...this.cleanMeta(meta),
    });
  }

  private stringifyMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    return JSON.stringify(message);
  }

  private cleanMeta(meta: LogMeta): LogMeta {
    return Object.entries(meta).reduce<LogMeta>((accumulator, [key, value]) => {
      if (value === undefined || value === '') {
        return accumulator;
      }

      accumulator[key as keyof LogMeta] = value as never;

      return accumulator;
    }, {});
  }
}
