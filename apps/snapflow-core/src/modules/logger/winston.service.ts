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

type LogMeta = {
  requestId?: string | null;
  functionName?: string;
  sourceName?: string;
  stack?: string;
};

@Injectable()
export class WinstonService {
  private readonly logger: winston.Logger;

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const loggerSettings: LoggerSettings = this.configService.get<LoggerSettings>('loggerSettings');
    const environmentSettings: EnvironmentSettings =
      this.configService.get<EnvironmentSettings>('environmentSettings');
    const isProduction: boolean = environmentSettings.isProduction;

    this.logger = winston.createLogger({
      levels: LOG_LEVELS,
      level: loggerSettings.level,
      defaultMeta: { serviceName: 'snapflow-core' },
      format: this.buildFormat(isProduction),
      transports: [new winston.transports.Console()],
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
    this.write('fatal', message, { requestId, functionName, sourceName, stack });
  }

  private buildFormat(isProduction: boolean): winston.Logform.Format {
    if (isProduction) {
      return winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      );
    }

    return winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const metadata = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}] ${message}${metadata}`;
      }),
    );
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
