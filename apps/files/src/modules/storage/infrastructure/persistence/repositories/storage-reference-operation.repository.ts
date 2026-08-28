import { Injectable } from '@nestjs/common';
import {
  Prisma,
  StorageReferenceOperation,
  StorageReferenceOperationType,
} from '@generated/prisma-files';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class StorageReferenceOperationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdempotencyKey(params: {
    consumer: string;
    idempotencyKey: string;
    operation: StorageReferenceOperationType;
  }): Promise<StorageReferenceOperation | null> {
    return this.prisma.storageReferenceOperation.findUnique({
      where: {
        consumer_idempotencyKey_operation: {
          consumer: params.consumer,
          idempotencyKey: params.idempotencyKey,
          operation: params.operation,
        },
      },
    });
  }

  async create(
    params: {
      consumer: string;
      idempotencyKey: string;
      operation: StorageReferenceOperationType;
      payloadHash: string;
      requestPayload: Prisma.InputJsonValue;
      resultPayload: Prisma.InputJsonValue;
    },
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<StorageReferenceOperation> {
    return tx.storageReferenceOperation.create({ data: params });
  }
}
