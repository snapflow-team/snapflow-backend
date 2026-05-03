import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

@Injectable()
export class AsyncLocalStorageService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

  start(callback: () => void): void {
    this.asyncLocalStorage.run(new Map<string, any>(), callback);
  }

  getStore(): Map<string, any> | undefined {
    return this.asyncLocalStorage.getStore();
  }
}
