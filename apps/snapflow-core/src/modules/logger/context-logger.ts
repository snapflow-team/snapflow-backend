import { WinstonService } from './winston.service';
import { serializeError } from './utils/serialize-error.util';

export class ContextLogger {
  constructor(
    private readonly winston: WinstonService,
    private readonly sourceName: string,
  ) {}

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

  trace(message: string, functionName?: string): void {
    this.winston.trace(message, this.sourceName, functionName);
  }

  debug(message: string, functionName?: string): void {
    this.winston.debug(message, this.sourceName, functionName);
  }

  log(message: string, functionName?: string): void {
    this.winston.info(message, this.sourceName, functionName);
  }

  warn(message: string, functionName?: string): void {
    this.winston.warn(message, this.sourceName, functionName);
  }

  error(message: unknown, functionName?: string): void {
    if (message instanceof Error) {
      const serialized = serializeError(message);

      this.winston.error(serialized.message, this.sourceName, functionName, serialized.stack);
      return;
    }

    this.winston.error(this.stringifyMessage(message), this.sourceName, functionName);
  }

  fatal(message: string, functionName?: string): void {
    this.winston.fatal(message, this.sourceName, functionName);
  }
}
