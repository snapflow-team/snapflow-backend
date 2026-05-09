import { Injectable, type LoggerService } from '@nestjs/common';
import { WinstonService } from './winston.service';

@Injectable()
export class CustomLogger implements LoggerService {
  constructor(private readonly winstonLogger: WinstonService) {}

  private stringifyMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return `${message.name}: ${message.message}`;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private isLikelyStack(value: string): boolean {
    return value.includes('\n') || value.includes(' at ');
  }

  private parseErrorArgs(
    message: unknown,
    stackOrContext?: string,
    context?: string,
  ): { messageStr: string; stack?: string; sourceName?: string } {
    if (message instanceof Error) {
      const messageStr = `${message.name}: ${message.message}`;
      const stack = message.stack;
      const sourceName = context ?? stackOrContext;

      return { messageStr, stack, sourceName };
    }

    const messageStr = this.stringifyMessage(message);

    if (context !== undefined) {
      return { messageStr, stack: stackOrContext, sourceName: context };
    }

    if (stackOrContext === undefined) {
      return { messageStr };
    }

    if (this.isLikelyStack(stackOrContext)) {
      return { messageStr, stack: stackOrContext };
    }

    return { messageStr, sourceName: stackOrContext };
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

  error(message: unknown, stackOrContext?: string, context?: string): void {
    const {
      messageStr,
      stack,
      sourceName,
    } = this.parseErrorArgs(message, stackOrContext, context);
    this.winstonLogger.error(messageStr, sourceName, undefined, stack);
  }

  fatal(message: unknown, context?: string): void {
    this.winstonLogger.fatal(this.stringifyMessage(message), context);
  }
}
