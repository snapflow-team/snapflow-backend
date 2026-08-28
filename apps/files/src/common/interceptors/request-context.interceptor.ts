import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { AsyncLocalStorageService } from '../async-local-storage/async-local-storage.service';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { REQUEST_ID_KEY } from '../../../../../libs/common/constants/request-id.constants';
import { unwrapPayload } from '../../../../../libs/common/rpc/rpc-envelope';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
    private readonly cryptoService: CryptoService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable((subscriber) => {
      this.asyncLocalStorageService.start(() => {
        const requestId = this.resolveRequestId(context);

        this.asyncLocalStorageService.getStore()?.set(REQUEST_ID_KEY, requestId);
        next.handle().subscribe(subscriber);
      });
    });
  }

  private resolveRequestId(context: ExecutionContext): string {
    if (context.getType() === 'rpc') {
      const raw: unknown = context.switchToRpc().getData<unknown>();
      const { meta } = unwrapPayload(raw);

      return meta.requestId ?? this.cryptoService.generateUUID();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-request-id'];

    if (typeof header === 'string' && header.length > 0) {
      return header;
    }

    return this.cryptoService.generateUUID();
  }
}
