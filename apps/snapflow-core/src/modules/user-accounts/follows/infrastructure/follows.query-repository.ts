import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { CursorQueryParamsDto } from '../../../../../../../libs/dto/cursor-query.params.dto';
import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  CursorPaginatedResult,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from '../../../../../../../libs/common/utils/cursor-pagination.util';
import { type CursorPayload, decodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { ProfileFollowListRow } from './types/profile-follow-list-row.type';

const ACTIVE_USER_WITH_PROFILE_FILTER = {
  deletedAt: null,
  isBanned: false,
  profiles: { some: { deletedAt: null } },
} as const;

@Injectable()
export class FollowsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isFollowing(viewerId: number, targetUserId: number): Promise<boolean> {
    const follow = await this.prisma.userFollow.findFirst({
      where: { followerId: viewerId, followingId: targetUserId, deletedAt: null },
      select: { id: true },
    });

    return follow !== null;
  }

  async getFollowingUserIds(userId: number): Promise<number[]> {
    const follows = await this.prisma.userFollow.findMany({
      where: { followerId: userId, deletedAt: null },
      select: { followingId: true },
      orderBy: { createdAt: 'desc' },
    });

    return follows.map((follow) => follow.followingId);
  }

  async getFollowingIdsAmong(viewerId: number, targetUserIds: number[]): Promise<Set<number>> {
    if (targetUserIds.length === 0) {
      return new Set();
    }

    const follows = await this.prisma.userFollow.findMany({
      where: {
        followerId: viewerId,
        followingId: { in: targetUserIds },
        deletedAt: null,
      },
      select: { followingId: true },
    });

    return new Set(follows.map((follow) => follow.followingId));
  }

  async findFollowingByProfileId(
    profileId: number,
    params: CursorQueryParamsDto,
  ): Promise<CursorPaginatedResult<ProfileFollowListRow>> {
    const ownerUserId: number = await this.resolveOwnerUserIdByProfileId(profileId);

    return this.findFollowListByRelation({
      params,
      where: {
        deletedAt: null,
        followerId: ownerUserId,
        following: ACTIVE_USER_WITH_PROFILE_FILTER,
      },
      mapUser: (row) => row.following,
    });
  }

  async findFollowersByProfileId(
    profileId: number,
    params: CursorQueryParamsDto,
  ): Promise<CursorPaginatedResult<ProfileFollowListRow>> {
    const ownerUserId = await this.resolveOwnerUserIdByProfileId(profileId);

    return this.findFollowListByRelation({
      params,
      where: {
        deletedAt: null,
        followingId: ownerUserId,
        follower: ACTIVE_USER_WITH_PROFILE_FILTER,
      },
      mapUser: (row) => row.follower,
    });
  }

  private async resolveOwnerUserIdByProfileId(profileId: number): Promise<number> {
    const profile = await this.prisma.userProfile.findFirst({
      where: { id: profileId, deletedAt: null },
      select: { userId: true },
    });

    if (!profile) {
      throw new NotFoundException(`A profile with this ID (${profileId}) was not found`);
    }

    return profile.userId;
  }

  private async findFollowListByRelation({
    params,
    where,
    mapUser,
  }: {
    params: CursorQueryParamsDto;
    where: Prisma.UserFollowWhereInput;
    mapUser: (row: FollowListRawRow) => FollowListUserRaw;
  }): Promise<CursorPaginatedResult<ProfileFollowListRow>> {
    const { cursor, limit } = params;
    const cursorPayload: CursorPayload | undefined = cursor ? decodeCursor(cursor) : undefined;

    const rows: FollowListRawRow[] = await this.prisma.userFollow.findMany({
      where: {
        ...where,
        ...(cursorPayload
          ? (buildKeysetCursorFilter(cursorPayload, {
              parseId: Number,
            }) as Prisma.UserFollowWhereInput)
          : {}),
      },
      select: {
        id: true,
        createdAt: true,
        follower: {
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
        },
        following: {
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
        },
      },
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(limit),
    });

    const paginated = buildCursorPaginatedResult(rows, limit, (row) => ({
      createdAt: row.createdAt,
      id: String(row.id),
    }));

    return {
      ...paginated,
      items: paginated.items.map((row) => this.mapFollowListRow(row, mapUser)),
    };
  }

  private mapFollowListRow(
    row: FollowListRawRow,
    mapUser: (row: FollowListRawRow) => FollowListUserRaw,
  ): ProfileFollowListRow {
    const user = mapUser(row);
    const profile = user.profiles[0];

    if (!profile) {
      throw new Error(`Active user profile is missing for follow list row ${row.id}`);
    }

    return {
      id: row.id,
      createdAt: row.createdAt,
      userId: user.id,
      username: user.username,
      avatarUrl: profile.avatarUrl,
      profileId: profile.id,
    };
  }
}

type FollowListUserRaw = {
  id: number;
  username: string;
  profiles: { id: number; avatarUrl: string | null }[];
};

type FollowListRawRow = {
  id: number;
  createdAt: Date;
  follower: FollowListUserRaw;
  following: FollowListUserRaw;
};
