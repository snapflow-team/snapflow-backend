import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DomainException } from '../exceptions/damain.exception';
import { DomainExceptionCode } from '../exceptions/types/domain-exception-codes';

@Injectable()
export class ParseUuidOrNotFoundPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (!isUUID(value)) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'Invalid UUID or invalid UUID',
      });
    }
  }
}
