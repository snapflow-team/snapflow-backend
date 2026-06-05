// import { Injectable } from '@nestjs/common';
// import { PrismaService } from '../../../../../database/prisma.service';
// import { Prisma, Session } from '@generated/prisma-snapflow';
//
// @Injectable()
// export class NotificationsRepository {
//   constructor(private readonly prisma: PrismaService) {}
//
//   async findByDeviceId(
//     deviceId: string,
//     tx: Prisma.TransactionClient = this.prisma,
//   ): Promise<Session | null> {
//     return tx.session.findFirst({
//       where: {
//         deviceId,
//         deletedAt: null,
//       },
//     });
//   }
//
//   async create(
//     data: Prisma.SessionCreateInput,
//     tx: Prisma.TransactionClient = this.prisma,
//   ): Promise<Session> {
//     return tx.session.create({
//       data,
//     });
//   }
//
//
// }
