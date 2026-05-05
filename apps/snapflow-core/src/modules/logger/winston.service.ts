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
  private readonly serviceName = 'snapflow-core';

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const loggerSettings: LoggerSettings = this.configService.get<LoggerSettings>('loggerSettings');
    const environmentSettings: EnvironmentSettings =
      this.configService.get<EnvironmentSettings>('environmentSettings');
    const timeFormat = 'YYYY-MM-DD HH:mm:ss';
    const { combine, timestamp, errors, colorize, printf } = winston.format;

    const metaSuffix = (info: winston.Logform.TransformableInfo): string => {
      const payload: Record<string, unknown> = {};
      const rid = info.requestId as string | null | undefined;
      if (rid !== undefined && rid !== null && rid !== '') {
        payload.requestId = rid;
      }
      if (info.functionName !== undefined && info.functionName !== '') {
        payload.functionName = info.functionName;
      }
      if (info.sourceName !== undefined && info.sourceName !== '') {
        payload.sourceName = info.sourceName;
      }
      if (info.stack !== undefined && info.stack !== '') {
        payload.stack = info.stack;
      }

      return Object.keys(payload).length > 0 ? ` ${JSON.stringify(payload)}` : '';
    };

    const devLineFormat = printf((info) => {
      const ts = String(info.timestamp ?? '');
      const lvl = String(info.level ?? '');
      const msg =
        typeof info.message === 'string'
          ? info.message
          : info.message === undefined || info.message === null
            ? ''
            : JSON.stringify(info.message);

      return `${ts} [${lvl}] ${msg}${metaSuffix(info)}`;
    });

    const consoleTransport = new winston.transports.Console({
      format: environmentSettings.isProduction
        ? combine(timestamp({ format: timeFormat }), errors({ stack: true }), winston.format.json())
        : combine(
            timestamp({ format: timeFormat }),
            errors({ stack: true }),
            colorize({ all: true, colors: { trace: 'yellow' } }),
            devLineFormat,
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
    this.logger.log(
      'fatal',
      message,
      this.cleanMeta({ requestId, functionName, sourceName, stack }),
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
