import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from '../../../../../libs/common/constants/request-id.constants';
import { CryptoService } from '../../../../../libs/common/services/crypto.service';
import { AsyncLocalStorageService } from '../async-local-storage/async-local-storage.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
    private readonly cryptoService: CryptoService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    this.asyncLocalStorageService.start(() => {
      const incomingRequestId: string | string[] | undefined = req.headers[REQUEST_ID_HEADER];

      const requestId: string =
        typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
          ? incomingRequestId
          : this.cryptoService.generateUUID();

      this.asyncLocalStorageService.getStore()?.set(REQUEST_ID_KEY, requestId);

      res.setHeader(REQUEST_ID_HEADER, requestId);

      next();
    });
  }
}
