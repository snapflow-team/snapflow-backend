import { DomainExceptionCode } from './types/domain-exception-codes';
import { ApiProperty } from '@nestjs/swagger';

export class Extension {
  @ApiProperty({ example: 'email' })
  public readonly field: string;

  @ApiProperty({ example: 'Invalid email format' })
  public readonly message: string;

  constructor(props: { field: string; message: string }) {
    this.field = props.field;
    this.message = props.message;
  }
}

export class DomainException extends Error {
  message: string;
  code: DomainExceptionCode;
  extensions: Extension[];

  constructor(errorInfo: { code: DomainExceptionCode; message: string; extensions?: Extension[] }) {
    super(errorInfo.message);

    this.message = errorInfo.message;
    this.code = errorInfo.code;
    this.extensions = errorInfo.extensions ?? [];
  }
}
