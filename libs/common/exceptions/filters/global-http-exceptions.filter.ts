import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { SnapflowCoreConfig } from '../../../../apps/snapflow-core/src/snapflow-core.config';
import { ErrorResponseDto } from '../dto/error-response-body.dto';

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
  constructor(private readonly snapflowCoreConfig: SnapflowCoreConfig) {}

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) status = exception.getStatus();

    const isExposeDetails: boolean = this.snapflowCoreConfig.sendInternalServerErrorDetails;

    const responseBody: ErrorResponseDto = ErrorResponseDto.fromInternalError(
      isExposeDetails ? request.url : null,
      isExposeDetails ? request.method : null,
      isExposeDetails ? (exception.message ?? 'Unknown exception occurred') : 'Some error occurred',
    );

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
