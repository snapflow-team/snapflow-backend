import { Injectable, type LoggerService } from '@nestjs/common';
import { WinstonService } from './winston.service';
import { serializeError } from './utils/serialize-error.util';

@Injectable()
export class CustomLogger implements LoggerService {
  constructor(private readonly winstonLogger: WinstonService) {}

  private stringifyMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private parseErrorArgs(
    message: unknown,
    stack?: string,
    context?: string,
  ): { messageStr: string; stack?: string; sourceName?: string } {
    if (message instanceof Error) {
      const { message: messageStr, stack: errorStack } = serializeError(message);

      return {
        messageStr,
        stack: stack ?? errorStack,
        sourceName: context,
      };
    }

    return {
      messageStr: this.stringifyMessage(message),
      stack,
      sourceName: context,
    };
  }

  trace(message: string, functionName?: string): void {
    this.winstonLogger.trace(message, undefined, functionName);
  }

  debug(message: unknown, context?: string): void {
    this.winstonLogger.debug(this.stringifyMessage(message), context);
  }

  log(message: unknown, context?: string): void {
    this.winstonLogger.info(this.stringifyMessage(message), context);
  }

  warn(message: unknown, context?: string): void {
    this.winstonLogger.warn(this.stringifyMessage(message), context);
  }

  verbose(message: unknown, context?: string): void {
    this.winstonLogger.trace(this.stringifyMessage(message), context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    const {
      messageStr,
      stack: resolvedStack,
      sourceName,
    } = this.parseErrorArgs(message, stack, context);
    this.winstonLogger.error(messageStr, sourceName, undefined, resolvedStack);
  }

  fatal(message: unknown, context?: string): void {
    this.winstonLogger.fatal(this.stringifyMessage(message), context);
  }
}
