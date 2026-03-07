import { CommonDomainExceptionCodeType } from './domain-exception-codes';

export interface IExtension {
  field: string;
  message: string;
}

export interface IDomainExceptionProps<TCode = CommonDomainExceptionCodeType> {
  code: TCode;
  message: string;
  extensions?: IExtension[];
}

export abstract class DomainException<TCode = CommonDomainExceptionCodeType> extends Error {
  public readonly code: TCode;
  public readonly message: string;
  public readonly extensions: IExtension[];

  constructor(props: IDomainExceptionProps<TCode>) {
    super(props.message);

    this.code = props.code;
    this.message = props.message;
    this.extensions = props.extensions ?? [];
  }
}
