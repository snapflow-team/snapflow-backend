import { PrismaService } from '../../src/database/prisma.service';
import { User } from '../../generated/prisma';

export class AuthTestManager {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }
}
