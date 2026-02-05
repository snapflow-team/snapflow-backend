import { Injectable } from '@nestjs/common';
import { Prisma, Session } from '../../../../../../generated/prisma';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.SessionCreateInput): Promise<Session> {
    return this.prisma.session.create({
      data,
    });
  }
}
