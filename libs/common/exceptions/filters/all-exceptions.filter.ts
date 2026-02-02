import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { SnapflowCoreConfig } from '../../../../apps/snapflow-core/src/snapflow-core.config';
import { Request, Response } from 'express';
import { ErrorResponse } from '../interfaces/error-response.interface';
import { IBaseResponse } from '../interfaces/base-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly config: SnapflowCoreConfig) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction: boolean = this.config.env === 'production';
    const status: number = exception instanceof HttpException ? exception.getStatus() : 500;

    let message: string = 'Internal server error';
    let code: string = 'INTERNAL_SERVER_ERROR';
    let errors: unknown[] = [];

    if (exception instanceof HttpException) {
      const exceptionResponse: string | object = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const errorBody = exceptionResponse as ErrorResponse;

        message = Array.isArray(errorBody.message)
          ? errorBody.message[0] || 'Validation error'
          : errorBody.message || exception.message;

        code = errorBody.code || 'ERROR';
        errors = errorBody.errors || [];
      } else {
        message = String(exceptionResponse);
      }
    } else if (exception instanceof Error && !isProduction) {
      message = exception.message;
    }

    const finalResponse: IBaseResponse = {
      success: false,
      statusCode: status,
      code,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      stack:
        !isProduction && status === 500 && exception instanceof Error ? exception.stack : undefined,
    };

    response.status(status).json(finalResponse);
  }
}
