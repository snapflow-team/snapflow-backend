import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Request, Response } from 'express';
import type { IDomainCodeMapper, IErrorResponseFactory } from '../../core';
import { CommonDomainExceptionCodeType, DomainException, errorResponseFactory, IErrorResponse, } from '../../core';

@Catch(DomainException)
export class DomainHttpExceptionsFilter<TCode = CommonDomainExceptionCodeType>
  implements ExceptionFilter<DomainException<TCode>>
{
  constructor(
    private readonly codeToStatusMapper: IDomainCodeMapper<TCode>,
    private readonly customFactory?: IErrorResponseFactory<TCode>,
  ) {}

  catch(exception: DomainException<TCode>, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number = this.codeToStatusMapper.mapToHttpStatus(exception.code);

    const errorResponseDto: IErrorResponse<TCode> = this.customFactory
      ? this.customFactory(exception, request.url, request.method)
      : errorResponseFactory(exception, request.url, request.method);

    response.status(status).json(errorResponseDto);
  }
}
