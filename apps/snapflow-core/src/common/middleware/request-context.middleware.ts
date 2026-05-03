import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { AsyncLocalStorageService } from '../async-local-storage/async-local-storage.service';

export const REQUEST_ID_KEY = 'requestId';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
    private readonly cryptoService: CryptoService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    this.asyncLocalStorageService.start(() => {
      const incomingRequestId = req.headers['x-request-id'];
      const requestId =
        typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
          ? incomingRequestId
          : this.cryptoService.generateUUID();

      this.asyncLocalStorageService.getStore()?.set(REQUEST_ID_KEY, requestId);

      res.setHeader('X-Request-Id', requestId);

      next();
    });
  }
}
