import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidationException } from '../validation-exception';
import { ErrorResponseDto } from '../dto/error-response-body.dto';

@Catch(ValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: ValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = HttpStatus.BAD_REQUEST;

    const errorResponseDto: ErrorResponseDto = ErrorResponseDto.fromDomainException(
      exception,
      request.url,
      request.method,
    );

    response.status(status).json(errorResponseDto);
  }
}
