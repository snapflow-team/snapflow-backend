import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Customer, Prisma } from '@generated/prisma-payments';
import { CreateCustomerInfrastructureDto } from './types/create-customer.infrastructure-dto';
import { DomainException } from '../../../../../../libs/exceptions/core';
import { NotFoundException } from '../../../../../snapflow-core/src/common/exceptions/domain-exceptions';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Customer | null> {
    return tx.customer.findFirst({
      where: { userId },
    });
  }
  async findById(id: number, tx: Prisma.TransactionClient = this.prisma): Promise<Customer | null> {
    return tx.customer.findFirst({
      where: { id },
    });
  }
  async createCustomer(
    data: CreateCustomerInfrastructureDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Customer> {
    return tx.customer.create({
      data: {
        stripeCusId: data.stripeCusId,
        userId: data.userId,
      },
    });
  }
}
