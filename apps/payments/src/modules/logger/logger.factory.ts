import { Injectable } from '@nestjs/common';
import { ContextLogger } from './context-logger';
import { WinstonService } from './winston.service';

@Injectable()
export class LoggerFactory {
  constructor(private readonly winston: WinstonService) {}

  create(sourceName: string): ContextLogger {
    return new ContextLogger(this.winston, sourceName);
  }
}
