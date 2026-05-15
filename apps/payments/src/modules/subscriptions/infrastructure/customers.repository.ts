import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Customer, Prisma } from '@generated/prisma-payments';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number, tx: Prisma.TransactionClient = this.prisma): Promise<Customer | null> {
    return tx.customer.findFirst({
      where: { id },
    });
  }

  async findByUserId(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Customer | null> {
    return tx.customer.findFirst({
      where: { userId },
    });
  }

  async findByStripeCustomerId(
    stripeCusId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Customer | null> {
    return tx.customer.findFirst({ where: { stripeCusId } });
  }

  //Это метод для создания кастомера, который еще не имеет stripeCusId, так как еще пока не был создан в страйп
  async createPendingCustomer(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Customer> {
    return tx.customer.create({
      data: {
        userId,
      },
    });
  }
}
