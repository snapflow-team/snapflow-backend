import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { MeViewDto } from '../../auth/api/view-dto/me.view-dto';
import { RawUserForMe } from './types/raw-user-for-me';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { TotalCountRegisteredUsersViewDto } from '../api/dto/view-dto/total-count-registered-users.view-dto';

@Injectable()
export class UsersQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async me(id: number): Promise<MeViewDto> {
    const user: RawUserForMe | null = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        username: true,
        email: true,
        accountType: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`The user with ID (${id}) does not exist`);
    }

    return MeViewDto.mapToView(user);
  }

  async countAllUsers(): Promise<TotalCountRegisteredUsersViewDto> {
    const totalUsers: number = await this.prisma.user.count({
      where: {
        deletedAt: null,
      },
    });

    return { totalCount: totalUsers };
  }
}
