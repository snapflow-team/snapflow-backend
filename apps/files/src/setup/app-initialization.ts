import { INestMicroservice } from '@nestjs/common';
import { applyRpcInitialization } from './app-rpc-initialization';

/** @deprecated Use applyRpcInitialization for RPC entrypoints. */
export const applyAppInitialization = (app: INestMicroservice): void => {
  applyRpcInitialization(app);
};
