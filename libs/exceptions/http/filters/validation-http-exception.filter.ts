import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import type { IErrorResponseFactory } from '../../core';
import { errorResponseFactory, IErrorResponse, ValidationException } from '../../core';

@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  constructor(private readonly customFactory?: IErrorResponseFactory<string>) {}

  catch(exception: ValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number = HttpStatus.BAD_REQUEST;

    const errorResponseBody: IErrorResponse<string> = this.customFactory
      ? this.customFactory(exception, request.url, request.method)
      : errorResponseFactory(exception, request.url, request.method);

    response.status(status).json(errorResponseBody);
  }
}
