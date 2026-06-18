import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { GetAdminUsersQueryParams } from '../../application/dto/get-admin-users-query.params';
import { AdminUsersBanStatusFilter } from '../../domain/enums/admin-users-ban-status-filter.enum';
import { AdminUserDetailsModel } from '../../api/models/admin-user-details.model';
import { AdminUserListItemModel } from '../../api/models/admin-user-list-item.model';
import { PageInfoModel } from '../../api/models/page-info.model';
import { PaginatedAdminUsersModel } from '../../api/models/paginated-admin-users.model';

export type AdminUserBrief = {
  username: string;
  avatarUrl: string | null;
  profileId: number | null;
};

@Injectable()
export class AdminUsersQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: GetAdminUsersQueryParams): Promise<PaginatedAdminUsersModel> {
    const { page, pageSize, search, banStatusFilter } = params;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(search && {
        username: {
          contains: search,
          mode: 'insensitive',
        },
      }),
      ...(banStatusFilter === AdminUsersBanStatusFilter.Blocked && { isBanned: true }),
      ...(banStatusFilter === AdminUsersBanStatusFilter.NotBlocked && { isBanned: false }),
    };

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          createdAt: true,
          profiles: {
            where: { deletedAt: null },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: params.getPrismaOrderBy(),
        skip: params.calculateSkip(),
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const pagesCount: number = Math.ceil(totalCount / pageSize);

    const items: AdminUserListItemModel[] = users.map(
      (user): AdminUserListItemModel => ({
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        profileId: user.profiles[0]?.id ?? null,
      }),
    );

    const pageInfo: PageInfoModel = {
      page,
      pageSize,
      totalCount,
      pagesCount,
    };

    return { items, pageInfo };
  }

  async findDetailsById(userId: number): Promise<AdminUserDetailsModel | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
        profiles: {
          where: { deletedAt: null },
          select: { id: true, avatarUrl: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.profiles[0]?.avatarUrl ?? null,
      createdAt: user.createdAt,
      profileId: user.profiles[0]?.id ?? null,
    };
  }

  async findUserIdsByUsernameSearch(search: string): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        username: {
          contains: search,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  async findUsersByIds(ids: number[]): Promise<Map<number, AdminUserBrief>> {
    const uniqueIds: number[] = [...new Set(ids)];

    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        profiles: {
          where: { deletedAt: null },
          select: { id: true, avatarUrl: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return new Map(
      users.map((user): [number, AdminUserBrief] => [
        user.id,
        {
          username: user.username,
          avatarUrl: user.profiles[0]?.avatarUrl ?? null,
          profileId: user.profiles[0]?.id ?? null,
        },
      ]),
    );
  }
}
