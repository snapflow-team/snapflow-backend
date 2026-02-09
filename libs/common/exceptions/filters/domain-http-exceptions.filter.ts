import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ErrorResponseDto } from '../dto/error-response-body.dto';
import { Request, Response } from 'express';
import { DomainException } from '../damain.exception';
import { DomainExceptionsCodeMapper } from '../utils/domain-exceptions-code.mapper';

@Catch(DomainException)
export class DomainHttpExceptionsFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number = DomainExceptionsCodeMapper.mapToHttpStatus(exception.code);

    const errorResponseDto: ErrorResponseDto = ErrorResponseDto.fromDomainException(
      exception,
      request.url,
      request.method,
    );

    response.status(status).json(errorResponseDto);
  }
}
