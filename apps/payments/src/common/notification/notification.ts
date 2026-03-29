import {
  PaymentsDomainExceptionCode,
  PaymentsDomainExceptionCodeType,
} from '../exceptions/domain-exception-codes';
import { IExtension } from '../../../../../libs/exceptions/core';

export class Notification<T = null> {
  private _data: T | null = null;
  private _code: PaymentsDomainExceptionCodeType = PaymentsDomainExceptionCode.Success;
  private _message: string = 'Success';
  private _extensions: IExtension[] = [];

  static ok<T>(data: T): Notification<T> {
    const notification = new Notification<T>();
    notification._data = data;
    return notification;
  }

  static fail<T = null>(
    code: PaymentsDomainExceptionCodeType,
    operationMessage: string,
  ): Notification<T> {
    const notification = new Notification<T>();
    notification._code = code;
    notification._message = operationMessage;
    return notification;
  }

  addExtension(field: string, message: string) {
    this._extensions.push({ field, message });
  }

  static copyErrors<TSource, TTarget>(source: Notification<TSource>): Notification<TTarget> {
    const target = new Notification<TTarget>();
    target._code = source.code;
    target._message = source.message;
    target._extensions = [...source.extensions];
    return target;
  }

  get hasErrors(): boolean {
    return this._code !== PaymentsDomainExceptionCode.Success;
  }
  get code(): PaymentsDomainExceptionCodeType {
    return this._code;
  }
  get message(): string {
    return this._message;
  }
  get extensions(): IExtension[] {
    return this._extensions;
  }
  get value(): T {
    if (this.hasErrors) {
      throw new Error(
        `Can't get value from failed notification. Code: ${this._code}, Message: ${this._message}`,
      );
    }
    return this._data as T;
  }
}
