import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../../core/domain-exception';
import { CommonDomainExceptionCodeType } from '../../core/domain-exception-codes';
import type { IDomainCodeMapper } from '../../core';
import { IErrorResponse } from '../../core/error-response';
import type { IErrorResponseFactory } from '../../core/error-response-factory';
import { errorResponseFactory } from '../../core/error-response-factory';

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

// import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
// import { ErrorResponseDto } from '../../../../apps/snapflow-core/src/common/exceptions/error-response-body.dto';
// import { Request, Response } from 'express';
// import { DomainException } from '../damain.exception';
// import { DomainExceptionsCodeMapper } from '../utils/domain-exceptions-code.mapper';
//
// @Catch(DomainException)
// export class DomainHttpExceptionsFilter implements ExceptionFilter {
//   catch(exception: DomainException, host: ArgumentsHost): void {
//     const ctx = host.switchToHttp();
//     const response = ctx.getResponse<Response>();
//     const request = ctx.getRequest<Request>();
//
//     const status: number = DomainExceptionsCodeMapper.mapToHttpStatus(exception.code);
//
//     const errorResponseDto: ErrorResponseDto = ErrorResponseDto.fromDomainException(
//       exception,
//       request.url,
//       request.method,
//     );
//
//     response.status(status).json(errorResponseDto);
//   }
// }
