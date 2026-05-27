import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { IServerErrorResponseFactory } from '../../core';
import { IErrorResponse, serverErrorResponseFactory } from '../../core';
import { cleanStackTrace } from '../../core/utils/clean-stack-trace';

/**
 * Когда передан — используется вместо встроенного NestJS Logger (например CustomLogger + Winston).
 */
export type GlobalExceptionsFilterLogger = {
  error(message: string, stack?: string): void;
  warn(message: string): void;
};

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  private readonly nestLogger: Logger = new Logger(GlobalExceptionsFilter.name);

  private readonly defaultLogSink: GlobalExceptionsFilterLogger = {
    error: (message: string, stack?: string): void => this.nestLogger.error(message, stack),
    warn: (message: string): void => this.nestLogger.warn(message),
  };

  constructor(
    private readonly isExposeDetails: boolean,
    private readonly customFactory?: IServerErrorResponseFactory<string>,
    private readonly externalLogger?: GlobalExceptionsFilterLogger,
  ) {}

  private get logSink(): GlobalExceptionsFilterLogger {
    return this.externalLogger ?? this.defaultLogSink;
  }

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) status = exception.getStatus();
    const responseBody: IErrorResponse<string> = this.customFactory
      ? this.customFactory(
          this.isExposeDetails ? request.url : null,
          this.isExposeDetails ? request.method : null,
          this.isExposeDetails
            ? (exception.message ?? 'Unknown exception occurred')
            : 'Some error occurred',
        )
      : serverErrorResponseFactory(
          this.isExposeDetails ? request.url : null,
          this.isExposeDetails ? request.method : null,
          this.isExposeDetails
            ? (exception.message ?? 'Unknown exception occurred')
            : 'Some error occurred',
        );

    this.logException(exception, request, status);

    response.status(status).json(responseBody);
  }

  private logException(exception: unknown, request: Request, status: number): void {
    const message = (exception as any)?.message || 'Unknown error occurred';

    const ip = request.headers['x-forwarded-for'] || request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown Agent';

    const logMessage = `[${request.method} ${request.originalUrl}] ${status} - ${message}`;

    const context = `IP: ${ip} | User-Agent: ${userAgent}`;

    if (true) {
      // if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = (exception as any)?.stack;
      const cleanStack = stack ? cleanStackTrace(stack) : 'Stack is not available';

      this.logSink.error(`${logMessage} | ${context}`, cleanStack);
    } else {
      this.logSink.warn(`${logMessage} | ${context}`);
    }
  }
}
