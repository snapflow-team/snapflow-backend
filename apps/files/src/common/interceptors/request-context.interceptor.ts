import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AsyncLocalStorageService } from '../async-local-storage/async-local-storage.service';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { REQUEST_ID_KEY } from '../../../../../libs/common/constants/request-id.constants';
import { unwrapPayload } from '../../../../../libs/common/rpc/rpc-envelope';

// vilyamz[files]: разобраться как работает Observable
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
    private readonly cryptoService: CryptoService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable((subscriber) => {
      this.asyncLocalStorageService.start(() => {
        const raw: unknown = context.switchToRpc().getData<unknown>();
        const { meta } = unwrapPayload(raw);
        const requestId: string = meta.requestId ?? this.cryptoService.generateUUID();

        this.asyncLocalStorageService.getStore()?.set(REQUEST_ID_KEY, requestId);
        next.handle().subscribe(subscriber);
      });
    });
  }
}
