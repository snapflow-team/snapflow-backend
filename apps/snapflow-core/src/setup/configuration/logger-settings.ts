import { IsEnum, IsNotEmpty } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export enum LoggerLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export class LoggerSettings {
  @IsNotEmpty()
  @IsEnum(LoggerLevel)
  level: LoggerLevel;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.level = environmentVariables.LOGGER_LEVEL as LoggerLevel;
  }
}
