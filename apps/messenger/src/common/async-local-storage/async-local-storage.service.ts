import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<Map<string, unknown>>();

@Injectable()
export class AsyncLocalStorageService {
  private readonly asyncLocalStorage = asyncLocalStorage;

  start(callback: () => void): void {
    this.asyncLocalStorage.run(new Map<string, unknown>(), () => {
      callback();
    });
  }

  getStore(): Map<string, unknown> | undefined {
    return this.asyncLocalStorage.getStore();
  }
}
