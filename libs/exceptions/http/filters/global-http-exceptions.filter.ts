import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import type { IServerErrorResponseFactory } from '../../core/error-response-factory';
import { serverErrorResponseFactory } from '../../core/error-response-factory';
import { IErrorResponse } from '../../core/error-response';

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly isExposeDetails: boolean,
    private readonly customFactory?: IServerErrorResponseFactory<string>,
  ) {}

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) status = exception.getStatus();
    // todo: добавить возможность переопределить фабрику формирования ответа
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
    // const responseBody: ErrorResponseDto = ErrorResponseDto.fromInternalError(
    //   this.isExposeDetails ? request.url : null,
    //   this.isExposeDetails ? request.method : null,
    //   this.isExposeDetails
    //     ? (exception.message ?? 'Unknown exception occurred')
    //     : 'Some error occurred',
    // );

    this.logException(exception, request, status);

    response.status(status).json(responseBody);
  }

  private logException(exception: unknown, request: Request, status: number): void {
    const logPayload = {
      level: status >= 500 ? 'error' : 'warn',
      timestamp: new Date().toISOString(),
      type: exception?.constructor?.name,
      message: (exception as any)?.message,
      request: {
        method: request.method,
        url: request.originalUrl,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    };

    console.error({
      ...logPayload,
      stack: (exception as any)?.stack,
    });
  }
}
