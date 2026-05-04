import {
  ConsoleLogger,
  type ConsoleLoggerOptions,
} from '@nestjs/common/services/console-logger.service';
import { Injectable, Scope } from '@nestjs/common';
import { WinstonService } from './winston.service';
import { AsyncLocalStorageService } from '../../common/async-local-storage/async-local-storage.service';
import { REQUEST_ID_KEY } from '../../common/middleware/request-context.middleware';

export type CustomLoggerPhase = 'bootstrap' | 'runtime';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger extends ConsoleLogger {
  /**
   * bootstrap — только `[Nest] ...` (Nest ConsoleLogger), без дубля в Winston.
   * runtime — Nest + Winston. Баннер старта — отдельно через `console.log` в `main.ts`.
   */
  private static phase: CustomLoggerPhase = 'bootstrap';

  /** После `listen` — обычное двойное логирование (Nest + Winston). */
  static enterRuntimePhase(): void {
    CustomLogger.phase = 'runtime';
  }

  /** Для тестов / повторного подъёма приложения. */
  static resetPhase(): void {
    CustomLogger.phase = 'bootstrap';
  }

  constructor(
    context: string,
    options: ConsoleLoggerOptions,
    private winstonLogger: WinstonService,
    private asyncLocalStorageService: AsyncLocalStorageService,
  ) {
    super(context, {
      ...options,
      logLevels: ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'],
    });
  }

  private getRequestId(): string | null {
    const raw: unknown = this.asyncLocalStorageService.getStore()?.get(REQUEST_ID_KEY);
    if (typeof raw === 'string' && raw.length > 0) {
      return raw;
    }

    return null;
  }

  private getSourceContext(): string | undefined {
    return this.context;
  }

  private getStack(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('stack' in error)) {
      return;
    }

    const stack = (error as { stack?: unknown }).stack;

    if (typeof stack !== 'string' || stack.length === 0) {
      return;
    }

    const secondLine = stack.split('\n')[1];
    return secondLine !== undefined ? secondLine : undefined;
  }

  private getErrorMessageForLog(error: unknown): string | undefined {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message: unknown = error.message;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }

    return;
  }

  private stringifyErrorForLog(error: unknown): string {
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

  private writeWinstonIfAllowed(writeFn: () => void): void {
    if (CustomLogger.phase === 'bootstrap') {
      return;
    }

    writeFn();
  }

  trace(message: string, functionName?: string) {
    super.verbose(message, this.getSourceContext() || functionName);

    this.writeWinstonIfAllowed(() => {
      this.winstonLogger.trace(message, this.getRequestId(), functionName, this.getSourceContext());
    });
  }

  debug(message: string, functionName?: string) {
    super.debug(message, this.getSourceContext() || functionName);

    this.writeWinstonIfAllowed(() => {
      this.winstonLogger.debug(message, this.getRequestId(), functionName, this.getSourceContext());
    });
  }

  log(message: string, functionName?: string) {
    super.log(message, this.getSourceContext() || functionName);

    this.writeWinstonIfAllowed(() => {
      this.winstonLogger.info(message, this.getRequestId(), functionName, this.getSourceContext());
    });
  }

  warn(message: string, functionName?: string) {
    super.warn(message, this.getSourceContext() || functionName);

    this.writeWinstonIfAllowed(() => {
      this.winstonLogger.warn(message, this.getRequestId(), functionName, this.getSourceContext());
    });
  }

  error(error: unknown, functionName?: string) {
    const stack: string | undefined = this.getStack(error);
    const jsonError: string = this.stringifyErrorForLog(error);
    const errMessage: string | undefined = this.getErrorMessageForLog(error);

    const fullErrorMessage = `${
      errMessage !== undefined ? `msg: ${errMessage}; ` : ''
    } fullError: ${jsonError}`;

    super.error(error, stack, this.getSourceContext() || functionName);

    this.writeWinstonIfAllowed(() => {
      this.winstonLogger.error(
        fullErrorMessage,
        this.getRequestId(),
        functionName,
        this.getSourceContext(),
        stack,
      );
    });
  }

  fatal(message: string, functionName?: string, stack?: string) {
    super.fatal(message, this.getSourceContext() || functionName);

    this.writeWinstonIfAllowed(() => {
      this.winstonLogger.fatal(
        message,
        this.getRequestId(),
        functionName,
        this.getSourceContext(),
        stack,
      );
    });
  }
}
