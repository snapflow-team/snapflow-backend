import { IsIn } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export const LOGGER_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LoggerLevel = (typeof LOGGER_LEVELS)[number];

export class LoggerSettings {
  @IsIn(LOGGER_LEVELS)
  private readonly LOGGER_LEVEL: LoggerLevel;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    const raw: string | undefined = environmentVariables.LOGGER_LEVEL?.trim();
    const normalized: LoggerLevel =
      raw !== undefined && raw !== '' && (LOGGER_LEVELS as readonly string[]).includes(raw)
        ? (raw as LoggerLevel)
        : 'info';

    this.LOGGER_LEVEL = normalized;
  }

  get level(): LoggerLevel {
    return this.LOGGER_LEVEL;
  }
}
