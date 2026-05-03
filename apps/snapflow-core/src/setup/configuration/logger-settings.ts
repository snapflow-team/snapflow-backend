import { IsIn } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export const LOGGER_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LoggerLevel = (typeof LOGGER_LEVELS)[number];

export class LoggerSettings {
  @IsIn(LOGGER_LEVELS)
  private readonly LOGGER_LEVEL: LoggerLevel;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.LOGGER_LEVEL = environmentVariables.LOGGER_LEVEL as LoggerLevel;
  }

  get level(): LoggerLevel {
    return this.LOGGER_LEVEL;
  }
}
