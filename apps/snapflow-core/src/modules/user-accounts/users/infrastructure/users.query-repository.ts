import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-snapflow';
import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  CursorPaginatedResult,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from '../../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../../database/prisma.service';
import { MeViewDto } from '../../auth/api/view-dto/me.view-dto';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { SearchUsersQueryParamsDto } from '../api/dto/input-dto/search-users.query-params.dto';
import { SearchUsersPageViewDto } from '../api/dto/view-dto/search-users-page.view-dto';
import { UserSearchResultViewDto } from '../api/dto/view-dto/user-search-result.view-dto';
import { TotalCountRegisteredUsersViewDto } from '../api/dto/view-dto/total-count-registered-users.view-dto';
import { RawUserForMe } from './types/raw-user-for-me';
import { RawUserForSearch } from './types/raw-user-for-search';

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
        profiles: {
          where: { deletedAt: null },
          select: { id: true },
          take: 1,
        },
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

  async searchUsers(params: SearchUsersQueryParamsDto): Promise<SearchUsersPageViewDto> {
    const { username, limit } = params;
    const cursorPayload: CursorPayload | undefined = params.cursor
      ? decodeCursor(params.cursor)
      : undefined;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      isBanned: false,
      username: { contains: username, mode: 'insensitive' },
      ...(cursorPayload
        ? (buildKeysetCursorFilter(cursorPayload, { parseId: Number }) as Prisma.UserWhereInput)
        : {}),
    };

    const rows: RawUserForSearch[] = await this.prisma.user.findMany({
      where,
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
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(limit),
    });

    const paginated: CursorPaginatedResult<RawUserForSearch> = buildCursorPaginatedResult(
      rows,
      limit,
      (user) => ({
        createdAt: user.createdAt,
        id: String(user.id),
      }),
    );

    return {
      items: paginated.items.map((i) => UserSearchResultViewDto.mapToView(i)),
      nextCursor: paginated.nextCursor,
      hasMore: paginated.hasMore,
    };
  }
}
