import {
  ConsoleLogger,
  type ConsoleLoggerOptions,
} from '@nestjs/common/services/console-logger.service';
import { Injectable, Scope } from '@nestjs/common';
import { WinstonService } from './winston.service';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger extends ConsoleLogger {
  constructor(
    context: string,
    options: ConsoleLoggerOptions,
    private winstonLogger: WinstonService,
  ) {
    super(context, {
      ...options,
      logLevels: ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'],
    });
  }

  private getSourceContext(): string | undefined {
    return this.context;
  }

  private getStack(error: any): string | undefined {
    const stack = error?.stack;

    if (stack) {
      return `${stack?.split('\n')[1]}`;
    }
  }

  private stringifyErrorForLog(error: any): string {
    if (error instanceof Error) {
      return JSON.stringify(error);
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  trace(message: string, functionName?: string) {
    // super.verbose(message, this.getSourceContext() || functionName);
    this.winstonLogger.trace(message, this.getSourceContext(), functionName);
  }

  debug(message: string, functionName?: string) {
    // super.debug(message, this.getSourceContext() || functionName);
    this.winstonLogger.debug(message, this.getSourceContext(), functionName);
  }

  log(message: string, functionName?: string) {
    // super.log(message, this.getSourceContext() || functionName);
    this.winstonLogger.info(message, this.getSourceContext(), functionName);
  }

  warn(message: string, functionName?: string) {
    // super.warn(message, this.getSourceContext() || functionName);
    this.winstonLogger.warn(message, this.getSourceContext(), functionName);
  }

  error(error: any, functionName?: string) {
    const stack: string | undefined = this.getStack(error);
    const jsonError: string = this.stringifyErrorForLog(error);

    const fullErrorMessage = `${
      error?.message ? `msg: ${error?.message}; ` : ''
    } fullError: ${jsonError}`;

    // super.error(error, stack, this.getSourceContext() || functionName);
    this.winstonLogger.error(
      fullErrorMessage,
      this.getSourceContext(),
      functionName,
      stack,
    );
  }

  fatal(message: string, functionName?: string, stack?: string) {
    // super.fatal(message, this.getSourceContext() || functionName);
    this.winstonLogger.fatal(
      message,
      this.getSourceContext(),
      functionName,
      stack,
    );
  }
}
